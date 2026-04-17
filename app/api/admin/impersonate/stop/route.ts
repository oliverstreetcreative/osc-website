import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from '@/lib/auth/impersonation'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // IMPORTANT: middleware does NOT apply impersonation headers to this path.
  // x-user-id is the REAL staff user's ID.
  const adminId = req.headers.get('x-user-id')
  const isStaff = req.headers.get('x-user-is-staff')

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (isStaff !== 'true') {
    return NextResponse.json({ error: 'Forbidden — staff only' }, { status: 403 })
  }

  // Read the current impersonation cookie to log who we were impersonating
  const impersonationCookie = req.cookies.get(IMPERSONATION_COOKIE)?.value
  let targetName = 'unknown'
  let targetId: string | null = null

  if (impersonationCookie) {
    const payload = await verifyImpersonationToken(impersonationCookie)
    if (payload) {
      targetName = payload.target_name
      targetId = payload.target_person_id
    }
  }

  // Log the impersonation end event
  const admin = await db.person.findUnique({
    where: { id: adminId },
    select: { name: true },
  })

  await db.portalEvent.create({
    data: {
      person_id: adminId,
      event_type: 'admin_impersonation_end',
      summary: `${admin?.name ?? 'Admin'} stopped impersonating ${targetName}`,
      details: {
        target_person_id: targetId,
        target_name: targetName,
      },
      source: 'portal_admin',
      source_bible_id: null,
      source_bible_table: null,
      published_at: null,
      publication_version: null,
    },
  })

  // Clear the cookie and redirect to admin impersonation page
  const isProduction = process.env.NODE_ENV === 'production'
  const response = NextResponse.redirect(new URL('/admin/impersonate', req.url))

  response.cookies.set(IMPERSONATION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 0,
    ...(isProduction ? { domain: '.oliverstreetcreative.com' } : {}),
  })

  return response
}
