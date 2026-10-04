import { NextRequest, NextResponse } from "next/server"
import { clearCookies, publicOrigin } from "@/lib/client/host"
import { revokeSession, sessionUser } from "@/lib/auth/require-session"
import { SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

// Sign out (SPEC §27 P0 v2): the session's ROW ends (so the cookie is dead even if a copy survives), then the cookies
// go: both names, host-only and any old domain-wide copy.
export async function POST(req: NextRequest) {
  const s = await sessionUser()
  if (s) await revokeSession(s.sid)
  const res = NextResponse.redirect(`${publicOrigin(req)}/login?signed_out=1`, 303)
  clearCookies(res, req, [SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN, "osc_impersonating", "cs_view"])
  return res
}
