// POST /api/scripts/invite/accept (form: token): the TAP that spends a script invite (SPEC §14 v4 #10). Signs the
// invitee in on this device and lands them on the script. Spent once, atomically; a second tap finds it used.
import { NextRequest, NextResponse } from "next/server"
import { readInvite, spendInvite } from "@/lib/scripts/server/invites"
import { startSession } from "@/lib/auth/session"
import { publicOrigin } from "@/lib/client/host"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get("token") ?? "")
  const origin = publicOrigin(req)
  const back = NextResponse.redirect(`${origin}/client/scripts/invite/${encodeURIComponent(token)}`, 303)
  const inv = await readInvite(token)
  if (!inv.ok) return back
  if (!(await spendInvite(inv.inviteId, inv.accessId))) return back
  const res = NextResponse.redirect(`${origin}/client/scripts/${inv.scriptId}`, 303)
  await startSession(req, res, inv.person)
  return res
}
