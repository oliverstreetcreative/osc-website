import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, COOKIE_DOMAIN } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'))

  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    domain: process.env.NODE_ENV === 'production' ? COOKIE_DOMAIN : undefined,
    path: '/',
  })

  return res
}
