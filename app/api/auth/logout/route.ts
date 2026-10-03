import { NextRequest, NextResponse } from 'next/server'
import { clearCookies } from '@/lib/client/host'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  // Sessions are host-only since 10/3; older ones were domain-wide. Clear both.
  clearCookies(res, req, ['osc_session', 'osc_impersonating', 'cs_view'])
  return res
}
