import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// POST /api/admin/invites/resend
// Extend an expired invite's expiry by 7 days and clear accepted_at.
// Note: actually sending the email is handled by a separate system.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const headersList = await headers()
  const userId  = headersList.get('x-user-id')
  const isStaff = headersList.get('x-user-is-staff')

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (isStaff !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse body
  let body: { invite_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { invite_id } = body
  if (!invite_id) {
    return NextResponse.json({ error: 'Missing required field: invite_id' }, { status: 400 })
  }

  try {
    // 3. Find the invite
    const existing = await db.portalInvite.findUnique({ where: { id: invite_id } })
    if (!existing) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // 4. Extend expiry to 7 days from now, clear accepted_at
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const updated = await db.portalInvite.update({
      where: { id: invite_id },
      data: {
        expires_at:  expiresAt,
        accepted_at: null,
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/invites/resend] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
