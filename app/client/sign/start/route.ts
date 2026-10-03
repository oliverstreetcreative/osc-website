import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { neededForJob, forClient, startSigning } from "@/lib/client/sign"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

// The signer is ALWAYS the signed-in person: the item must be theirs (their email),
// on a project of their organization that is published, and the engine binds
// the link to that email. Staff viewing as a client never get here (middleware
// refuses writes in that mode).
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!ctx || ctx.viewing) return new NextResponse(null, { status: 404 })
  const form = await req.formData()
  const job = String(form.get("job") ?? "")
  const itemId = String(form.get("item") ?? "")
  const template = String(form.get("template") ?? "")
  const back = `${publicOrigin(req)}/client`

  const project = await db.project.findFirst({
    where: { organization_id: ctx.org.id, hidden: false, job_number: job },
    select: { id: true },
  })
  if (!project) return NextResponse.redirect(back, 303)
  const items = await neededForJob(job)
  const mine = forClient(items ?? [], [ctx.user.email], false).find((i) => i.id === itemId)
  if (!mine || !mine.can_start || !mine.templates.includes(template) || mine.status === "signed") {
    return NextResponse.redirect(back, 303)
  }
  const started = await startSigning(job, itemId, template, ctx.user.email)
  if (!started?.sign_url) return NextResponse.redirect(`${back}?sign=unavailable`, 303)
  const url = started.sign_url.startsWith("http") ? started.sign_url : `${process.env.SIGN_HERE_URL}${started.sign_url}`
  return NextResponse.redirect(url, 303)
}
