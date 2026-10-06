// POST /client/library/heart (form: clip_id, on=1|0): a client hearts a footage clip (SPEC §23 v2). Append-only: each
// tap is a row; the latest row per person and clip is the state. Never while viewing as the client, never for a
// staging preview sign-in, never in the demo. The 5-minute run writes each row to the ledger for Stacks to import.
import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { publicOrigin } from "@/lib/client/host"
import { isDemoSlug } from "@/lib/client/demo"
import { db } from "@/lib/db"
import { isPreviewSession } from "@/lib/auth/require-session"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req)
  const ctx = await getClientContext()
  if (!ctx) return NextResponse.redirect(`${origin}/login`, 303)
  const form = await req.formData().catch(() => null)
  const clipId = String(form?.get("clip_id") ?? "")
  const on = String(form?.get("on") ?? "") === "1"
  if (!/^[0-9a-f-]{36}$/i.test(clipId)) return NextResponse.redirect(`${origin}/client/projects`, 303)
  const clip = await db.libraryClip.findFirst({
    where: {
      id: clipId,
      hidden: false,
      library: { hidden: false, organization_id: { in: ctx.orgs.map((o) => o.id) }, project: { hidden: false } },
    },
    select: {
      id: true,
      library: { select: { id: true, organization_id: true, project: { select: { slug: true, organization: { select: { slug: true } } } } } },
    },
  })
  if (!clip?.library.project.slug) return NextResponse.redirect(`${origin}/client/projects`, 303)
  const back = `${origin}/client/projects/${clip.library.project.slug}/footage/${clip.library.id}/${clip.id}`
  const readOnly = !!ctx.viewing || (await isPreviewSession()) || isDemoSlug(clip.library.project.organization?.slug)
  if (readOnly) return NextResponse.redirect(back, 303)
  await db.libraryHeart.create({
    data: { clip_id: clip.id, person_id: ctx.user.id, organization_id: clip.library.organization_id, favorite: on },
  })
  return NextResponse.redirect(`${back}?saved=${on ? "1" : "0"}`, 303)
}
