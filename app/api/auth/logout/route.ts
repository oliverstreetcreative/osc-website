import { NextRequest, NextResponse } from 'next/server'
import { clearCookies } from '@/lib/client/host'
import { revokeSession, sessionUser } from '@/lib/auth/require-session'
import { SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

// Sign out from a fetch (SPEC §27 P0 v2): the session's row ends, then the cookies (both names; any domain-wide copy).
export async function POST(req: NextRequest) {
  const s = await sessionUser()
  if (s) await revokeSession(s.sid)
  const res = NextResponse.json({ ok: true })
  clearCookies(res, req, [SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN, 'osc_impersonating', 'cs_view'])
  return res
}
