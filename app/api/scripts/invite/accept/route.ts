// POST /api/scripts/invite/accept (form: token, confirm?): the TAP that spends a script invite (SPEC §14 v4 #10; §27
// P0 v2 #6). It opens THAT script and nothing else: a scoped session (no person claim; the server refuses it
// everywhere but its own script). The same person, already signed in, keeps their full session. Someone ELSE signed
// in on this browser is asked first (?switch=1), so a forwarded invite never silently swaps who's signed in.
import { NextRequest, NextResponse } from "next/server"
import { readInvite, spendInvite } from "@/lib/scripts/server/invites"
import { startSession } from "@/lib/auth/session"
import { revokeSession, sessionUser } from "@/lib/auth/require-session"
import { deviceFrom } from "@/lib/auth/door"
import { publicOrigin } from "@/lib/client/host"
import { sameOrigin } from "@/lib/support/http"
import { mayViewClientSite } from "@/lib/auth/signin-only"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get("token") ?? "")
  const origin = publicOrigin(req)
  const page = `${origin}/client/scripts/invite/${encodeURIComponent(token)}`
  if (!sameOrigin(req)) return NextResponse.redirect(page, 303)
  const inv = await readInvite(token)
  if (!inv.ok) return NextResponse.redirect(page, 303)
  // Sam's test phase (CLIENT_SIGNIN_ONLY): someone it refuses never spends the invite (it stays good for later). Seeing
  // a client page is the stricter test (it implies signing in).
  if (!mayViewClientSite(inv.person)) return NextResponse.redirect(page, 303)
  const current = await sessionUser()
  const same = !!current && current.person.id === inv.person.id
  if (current && !same && form?.get("confirm") !== "1") return NextResponse.redirect(`${page}?switch=1`, 303)
  if (!(await spendInvite(inv.inviteId, inv.accessId))) return NextResponse.redirect(page, 303)
  const res = NextResponse.redirect(`${origin}/client/scripts/${inv.scriptId}`, 303)
  // Already signed in as this person (a full session, or this script's own): keep it.
  if (same && (!current!.scope || current!.scope.id === inv.scriptId.toLowerCase())) return res
  // Replacing someone else's session, or another script's: that one ends, not lingers as a live device.
  if (current) await revokeSession(current.sid)
  await startSession(req, res, inv.person, { kind: "script", scope: `script:${inv.scriptId.toLowerCase()}`, deviceId: deviceFrom(req) })
  return res
}
