import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { getStaffUser } from '@/lib/portal-auth'
import { getPortalUser } from '@/lib/portal-auth'

const VALID_STATUSES = ['Reviewed', 'Bounced', 'Not Ready'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const headersList = await headers()
  const userId  = (await getPortalUser())?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Staff status from the database, not the session token (which can be weeks stale).
  if (!(await getStaffUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: { review_status: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(body.review_status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid review_status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const upload = await db.portalUpload.findUnique({ where: { id } })
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }
    // portal_uploads has no review_status column, so the old update here could never succeed
    // (a Prisma error on every call; nothing in the UI calls this route). Uploads in are being
    // redesigned (client-site SPEC §0.4: untrusted, pulled and sealed on the Mac); until then this
    // says so plainly instead of throwing.
    return NextResponse.json(
      { error: 'Upload review is not available yet.' },
      { status: 410 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/uploads/review] Error:', message)
    return NextResponse.json({ error: 'Upload review failed.' }, { status: 500 })
  }
}
