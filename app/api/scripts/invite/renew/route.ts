// POST /api/scripts/invite/renew (form: token): "Send me a new link" from a used or expired invite page (SPEC §14
// v4 #10). Only while the script is still shared with them, only to the email on record, at most one new link per
// 10 minutes. The page then says "Check your email" without revealing more than a masked address.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { newInvite, readInvite } from "@/lib/scripts/server/invites"
import { inviteEmail, sendScriptMail } from "@/lib/scripts/server/mail"
import { publicOrigin } from "@/lib/client/host"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get("token") ?? "")
  const origin = publicOrigin(req)
  const page = (sent: boolean) => NextResponse.redirect(`${origin}/client/scripts/invite/${encodeURIComponent(token)}${sent ? "?sent=1" : ""}`, 303)
  const inv = await readInvite(token)
  if (inv.ok || inv.why === "unknown" || inv.why === "revoked" || !inv.accessId || !inv.email) return page(false)
  const recent = await db.scriptInvite.findFirst({ where: { access_id: inv.accessId, created_at: { gt: new Date(Date.now() - 10 * 60 * 1000) } } })
  if (recent) return page(true) // one fresh link per 10 minutes is plenty; don't say whether this one sent
  const access = await db.scriptAccess.findUnique({ where: { id: inv.accessId }, select: { invited_by: true } })
  const sharer = access ? await db.person.findUnique({ where: { id: access.invited_by }, select: { first_name: true, name: true } }) : null
  const fresh = await newInvite(inv.accessId)
  const mail = inviteEmail((sharer?.first_name || sharer?.name || "Oliver Street Creative").split(/\s+/)[0], inv.title ?? "your script", `${origin}/client/scripts/invite/${fresh}`)
  await sendScriptMail(inv.email, mail.subject, mail.html)
  return page(true)
}
