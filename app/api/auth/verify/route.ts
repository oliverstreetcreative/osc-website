import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { clientHome, startSession } from '@/lib/auth/session'

function redirectForRole(role: string, isStaff: boolean, host: string): string {
  // Staff: the admin on the login host; anywhere else, the client site's
  // "View as client" picker on the same host.
  if (isStaff || role === 'STAFF') {
    return host.startsWith('login.') ? 'https://login.oliverstreetcreative.com/admin' : '/client/view-as'
  }
  if (role === 'CREW') return 'https://crew.oliverstreetcreative.com/'
  // Clients land on the client site on the host they signed in from
  // (oliverstreetcreative.com/client in production, the staging domain on staging).
  return '/client'
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

  let redirectTo = redirectForRole(
    person.role,
    person.is_staff,
    (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase(),
  )
  // A client whose only business with us is a script lands on their scripts, not an empty portal (SPEC §14).
  if (redirectTo === '/client') redirectTo = await clientHome(person.id)
  const res = NextResponse.json({ redirectTo })
  await startSession(req, res, person)
  return res
}
