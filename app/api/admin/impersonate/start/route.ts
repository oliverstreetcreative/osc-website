import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createImpersonationToken, IMPERSONATION_COOKIE } from '@/lib/auth/impersonation'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read real session headers (set by middleware from osc_session)
  const adminId = req.headers.get('x-user-id')
  const isStaff = req.headers.get('x-user-is-staff')

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (isStaff !== 'true') {
    return NextResponse.json({ error: 'Forbidden — staff only' }, { status: 403 })
  }

  // Parse body — supports both JSON (fetch) and form-encoded (HTML form)
  let targetPersonId: string | undefined
  let reason: string | undefined

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    let body: { targetPersonId?: string; reason?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    targetPersonId = body.targetPersonId
    reason = body.reason
  } else {
    // application/x-www-form-urlencoded (HTML form)
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    targetPersonId = formData.get('targetPersonId')?.toString()
    reason = formData.get('reason')?.toString()
  }

  if (!targetPersonId) {
    return NextResponse.json({ error: 'targetPersonId is required' }, { status: 400 })
  }

  // Validate target: must exist, portal_allowed, not staff, not self
  const target = await db.person.findUnique({
    where: { id: targetPersonId },
    select: { id: true, name: true, email: true, role: true, is_staff: true, portal_allowed: true },
  })

  if (!target) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
  }
  if (!target.portal_allowed) {
    return NextResponse.json({ error: 'Target user does not have portal access' }, { status: 400 })
  }
  if (target.is_staff) {
    return NextResponse.json({ error: 'Cannot impersonate staff members' }, { status: 400 })
  }
  if (target.id === adminId) {
    return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
  }

  // Rate limit: max 10 impersonation starts per admin per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCount = await db.portalEvent.count({
    where: {
      event_type: 'admin_impersonation_start',
      person_id: adminId,
      occurred_at: { gte: oneHourAgo },
    },
  })
  if (recentCount >= 10) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — max 10 impersonation sessions per hour' },
      { status: 429 },
    )
  }

  // Fetch admin info for the token/log
  const admin = await db.person.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, email: true },
  })
  if (!admin) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
  }

  // Create the impersonation JWT
  const token = await createImpersonationToken({
    impersonatorPersonId: adminId,
    targetPersonId: target.id,
    targetRole: target.role,
    targetName: target.name,
    targetEmail: target.email,
  })

  // Log the impersonation start event
  await db.portalEvent.create({
    data: {
      person_id: adminId,
      event_type: 'admin_impersonation_start',
      summary: `${admin.name} started impersonating ${target.name} (${target.role})`,
      details: {
        target_person_id: target.id,
        target_name: target.name,
        target_email: target.email,
        target_role: target.role,
        reason: reason ?? null,
      },
      source: 'portal_admin',
      source_bible_id: null,
      source_bible_table: null,
      published_at: null,
      publication_version: null,
    },
  })

  // Determine redirect URL based on target role
  const redirectPath = target.role === 'CREW' ? '/crew' : '/client'

  // Set cookie and redirect to target portal
  const isProduction = process.env.NODE_ENV === 'production'
  const redirectUrl = new URL(redirectPath, req.url)
  const response = NextResponse.redirect(redirectUrl)

  response.cookies.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 3600,
    ...(isProduction ? { domain: '.oliverstreetcreative.com' } : {}),
  })

  return response
}
