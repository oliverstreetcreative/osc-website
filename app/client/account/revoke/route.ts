// POST /client/account/revoke (form: sid | all=1): sign a device out, or every device (SPEC §27 P0 v2). Only this
// person's own sessions; a script, preview or demo session can end only itself. Ending the session in use clears its
// cookie and goes to the sign-in page.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { revokeAll, revokeSession, sessionUser } from "@/lib/auth/require-session"
import { SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE } from "@/lib/auth/session"
import { clearCookies, publicOrigin } from "@/lib/client/host"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req)
  const s = await sessionUser()
  if (!s) return NextResponse.redirect(`${origin}/login`, 303)
  const form = await req.formData().catch(() => null)
  const full = s.kind === "person" && !s.scope
  let endedMine = false
  if (form?.get("all") === "1" && full) {
    await revokeAll(s.person.id)
    endedMine = true
  } else {
    const sid = String(form?.get("sid") ?? "")
    if (!UUID.test(sid)) return NextResponse.redirect(`${origin}/client/account`, 303)
    if (!full && sid !== s.sid) return NextResponse.redirect(`${origin}/client/account`, 303)
    const row = await db.portalSession.findUnique({ where: { id: sid }, select: { person_id: true } })
    if (!row || row.person_id !== s.person.id) return NextResponse.redirect(`${origin}/client/account`, 303)
    await revokeSession(sid)
    endedMine = sid === s.sid
  }
  if (!endedMine) return NextResponse.redirect(`${origin}/client/account`, 303)
  const res = NextResponse.redirect(`${origin}/login?signed_out=1`, 303)
  clearCookies(res, req, [SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN, "osc_impersonating", "cs_view"])
  return res
}
