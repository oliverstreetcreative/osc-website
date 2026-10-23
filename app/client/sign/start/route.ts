import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { forClient, isDone, neededForJob, signBase, startSigning } from "@/lib/client/sign"
import { publicOrigin } from "@/lib/client/host"
import { isPreviewSession } from "@/lib/auth/require-session"
import { memberOrg } from "@/lib/client/orgs"

export const dynamic = "force-dynamic"

// Sign Here contract v2. The signer is ALWAYS the signed-in person: the item must be in the engine's list for THEM
// (their own paper), on a published project of their organization; the engine picks the template and binds the link
// to their session's email. Staff viewing as a client never get here (middleware refuses writes in that mode).
// Outcomes come back to Home as a fixed word (?sign=office|unavailable), never as text from the engine or the URL.
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!ctx || ctx.viewing) return new NextResponse(null, { status: 404 })
  const back = `${publicOrigin(req)}/client`
  // A staging screenshot sign-in (/api/auth/preview) can look at everything and sign nothing (as approve and accept).
  if ((await isPreviewSession())) return NextResponse.redirect(back, 303)
  const form = await req.formData()
  const job = String(form.get("job") ?? "")
  const itemId = String(form.get("item") ?? "")
  // The paper's own org (SPEC §30 v2), only when it's one of theirs; none named = the selected org, as before.
  const named = form.get("org")
  const org = memberOrg(ctx, typeof named === "string" ? named : null)
  if (!org) return NextResponse.redirect(back, 303)

  const project = await db.project.findFirst({
    where: { organization_id: org.id, hidden: false, job_number: job },
    select: { id: true, slug: true },
  })
  if (!project) return NextResponse.redirect(back, 303)
  // From here, outcomes go back to the paper's own project page (it may be another of their orgs: built review).
  const there = project.slug ? `${publicOrigin(req)}/client/projects/${encodeURIComponent(project.slug)}` : back
  const viewer = { email: ctx.user.email }
  const list = await neededForJob(job, org.slug, viewer)
  if (!list || !list.ok) return NextResponse.redirect(`${there}?sign=unavailable`, 303)
  const mine = forClient(list.items, viewer).find((i) => i.id === itemId)
  if (!mine || !mine.can_start || isDone(mine)) return NextResponse.redirect(there, 303)

  const started = await startSigning(job, org.slug, ctx.user.email, itemId)
  if (!started.ok) return NextResponse.redirect(`${there}?sign=${started.reason}`, 303)
  // The engine answers with its own URL (absolute or root-relative); only ever send the browser to the engine.
  const url = new URL(started.sign_url, `${signBase()}/`)
  if (url.origin !== new URL(`${signBase()}/`).origin) return NextResponse.redirect(`${back}?sign=unavailable`, 303)
  return NextResponse.redirect(url.toString(), 303)
}
