// POST /client/review/approve (form: film_id, version_id, version_n, note): the approval of record (SPEC §13 v4). The
// page sent the newest version's id and number; approveVersion re-reads Review and refuses a stale page. Success → the
// receipt; a refusal → back to the approve page with a CODE (its words live on the page, never in the URL).
import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { approveVersion, clientIp, filmKeyOf } from "@/lib/client/approvals"
import { publicOrigin } from "@/lib/client/host"
import { db } from "@/lib/db"
import { isPreviewSession } from "@/lib/auth/require-session"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req)
  const ctx = await getClientContext()
  if (!ctx) return NextResponse.redirect(`${origin}/login`, 303)
  const form = await req.formData().catch(() => null)
  const filmId = String(form?.get("film_id") ?? "")
  const versionId = String(form?.get("version_id") ?? "")
  const shown = Number(form?.get("version_n") ?? "")
  const note = String(form?.get("note") ?? "")
  const film = /^[0-9a-f-]{36}$/i.test(filmId)
    ? await db.deliverable.findFirst({
        where: { id: filmId, project: { organization_id: { in: ctx.orgs.map((o) => o.id) } } },
        select: { ext_key: true, project: { select: { slug: true } } },
      })
    : null
  if (!film?.project.slug) return NextResponse.redirect(`${origin}/client/projects`, 303)
  const back = `${origin}/client/projects/${film.project.slug}/approve/${encodeURIComponent(filmKeyOf(film.ext_key) ?? "")}`
  const r = await approveVersion(ctx, filmId, versionId, Number.isInteger(shown) && shown > 0 ? shown : null, note, {
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    // A staging screenshot sign-in (/api/auth/preview) can look at everything and approve nothing.
    preview: (await isPreviewSession()),
  })
  if (!r.ok) return NextResponse.redirect(`${back}?why=${r.code}${r.at ? `&at=${encodeURIComponent(r.at)}` : ""}`, 303)
  return NextResponse.redirect(`${origin}/client/approvals/${r.approvalId}`, 303)
}
