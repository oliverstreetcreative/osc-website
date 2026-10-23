// RETIRED with the impersonation (client-website SPEC §27 P0 v2). Kept only to clear an old cookie someone may still
// hold (it does nothing now); answers with a redirect to the admin.
import { NextRequest, NextResponse } from 'next/server'
import { clearCookies, publicOrigin } from '@/lib/client/host'

export const dynamic = 'force-dynamic'

export function POST(req: NextRequest) {
  const res = NextResponse.redirect(`${publicOrigin(req)}/admin`, 303)
  clearCookies(res, req, ['osc_impersonating'])
  return res
}
