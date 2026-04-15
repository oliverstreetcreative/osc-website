import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { isImpersonating } from '@/lib/auth/impersonation'

// ---------------------------------------------------------------------------
// POST /api/admin/invites/revoke
// Delete an active invite record permanently.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Impersonation check — read-only mode
  if (await isImpersonating()) {
    return NextResponse.json(
      { error: 'Impersonation mode is read-only. Stop impersonating to take actions.' },
      { status: 403 },
    )
  }

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

    // 4. Delete the invite
    await db.portalInvite.delete({ where: { id: invite_id } })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/invites/revoke] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
