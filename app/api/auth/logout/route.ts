import { NextRequest, NextResponse } from 'next/server'
import { cookieDomainFor, isSecure } from '@/lib/client/host'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  // Session cookie is scoped to .oliverstreetcreative.com so all subdomains share
  // it; clearing it requires the same domain attribute.
  for (const name of ['osc_session', 'osc_impersonating']) {
    res.cookies.set(name, '', {
      domain: cookieDomainFor(req),
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure(req),
    })
  }
  return res
}
