import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // Session cookie is scoped to .oliverstreetcreative.com so all subdomains share
  // it; clearing it requires the same domain attribute.
  for (const name of ['osc_session', 'osc_impersonating']) {
    res.cookies.set(name, '', {
      domain: '.oliverstreetcreative.com',
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    })
  }
  return res
}
