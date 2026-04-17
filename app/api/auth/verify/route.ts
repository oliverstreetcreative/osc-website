import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { SignJWT } from 'jose'

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawToken = body.token?.trim()
  if (!rawToken) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const invite = await db.portalInvite.findUnique({
    where: { magic_link_hash: tokenHash },
    include: { person: { select: { id: true, email: true, name: true, role: true, is_staff: true, portal_allowed: true } } },
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 401 })
  }

  if (invite.expires_at < new Date()) {
    return NextResponse.json({ error: 'This link has expired. Please request a new one.' }, { status: 401 })
  }

  if (!invite.person.portal_allowed) {
    return NextResponse.json({ error: 'Portal access is not enabled for this account' }, { status: 403 })
  }

  await db.portalInvite.update({
    where: { id: invite.id },
    data: { accepted_at: new Date() },
  })

  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) {
    console.error('[auth/verify] SESSION_JWT_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const jwt = await new SignJWT({
    id: invite.person.id,
    email: invite.person.email,
    role: invite.person.role,
    is_staff: invite.person.is_staff,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret))

  const sessionHash = createHash('sha256').update(jwt).digest('hex')
  await db.portalSession.create({
    data: {
      person_id: invite.person.id,
      token_hash: sessionHash,
      expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  })

  const redirectTo = invite.person.role === 'CREW' ? '/crew' :
                     invite.person.role === 'CLIENT' ? '/client' :
                     invite.person.is_staff ? '/admin' : '/'

  const res = NextResponse.json({ redirectTo })
  res.cookies.set('osc_session', jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  return res
}
