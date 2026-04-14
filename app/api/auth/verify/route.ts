import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashToken,
  createSessionToken,
  SESSION_COOKIE_NAME,
  COOKIE_DOMAIN,
} from '@/lib/auth'

const SEVEN_DAYS = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  const body = await req.json()
  const token = body?.token

  if (typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const hash = hashToken(token)

  const invite = await db.portalInvite.findUnique({
    where: { magic_link_hash: hash },
    include: { person: true },
  })

  if (!invite || invite.expires_at < new Date() || invite.accepted_at !== null) {
    return NextResponse.json(
      { error: 'Invalid or expired link' },
      { status: 401 }
    )
  }

  await db.portalInvite.update({
    where: { id: invite.id },
    data: { accepted_at: new Date() },
  })

  const user = invite.person

  const sessionToken = await createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_staff: user.is_staff,
    portal_allowed: user.portal_allowed,
  })

  const redirectTo =
    user.is_staff || user.role === 'STAFF'
      ? '/admin'
      : user.role === 'CREW'
        ? '/crew'
        : '/client'

  const res = NextResponse.json({ ok: true, redirectTo })

  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SEVEN_DAYS,
    domain: process.env.NODE_ENV === 'production' ? COOKIE_DOMAIN : undefined,
    path: '/',
  })

  return res
}
