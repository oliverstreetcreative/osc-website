import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { SignJWT } from 'jose'
import { db } from '@/lib/db'

const SESSION_TTL_DAYS = 30

function redirectForRole(role: string, isStaff: boolean): string {
  if (isStaff || role === 'STAFF') return 'https://login.oliverstreetcreative.com/admin'
  if (role === 'CREW') return 'https://crew.oliverstreetcreative.com/'
  return 'https://client.oliverstreetcreative.com/'
}

export async function POST(req: NextRequest) {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let token: string
  try {
    const body = await req.json()
    token = String(body?.token ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const invite = await db.portalInvite.findUnique({
    where: { magic_link_hash: tokenHash },
    include: {
      person: {
        select: {
          id: true,
          email: true,
          role: true,
          is_staff: true,
          portal_allowed: true,
        },
      },
    },
  })

  if (!invite || invite.accepted_at || invite.expires_at < new Date() || !invite.person.portal_allowed) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const { person } = invite

  await db.portalInvite.update({
    where: { id: invite.id },
    data: { accepted_at: new Date() },
  })

  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  const jwt = await new SignJWT({
    id: person.id,
    email: person.email,
    role: person.role,
    is_staff: person.is_staff,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(sessionExpiresAt.getTime() / 1000))
    .sign(new TextEncoder().encode(secret))

  const sessionHash = createHash('sha256').update(jwt).digest('hex')
  await db.portalSession.create({
    data: {
      person_id: person.id,
      token_hash: sessionHash,
      expires_at: sessionExpiresAt,
      last_active_at: new Date(),
    },
  })

  const redirectTo = redirectForRole(person.role, person.is_staff)
  const res = NextResponse.json({ redirectTo })
  res.cookies.set('osc_session', jwt, {
    domain: '.oliverstreetcreative.com',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    expires: sessionExpiresAt,
  })
  return res
}
