import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

const VALID_STATUSES = ['Reviewed', 'Bounced', 'Not Ready'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const headersList = await headers()
  const userId  = headersList.get('x-user-id')
  const isStaff = headersList.get('x-user-is-staff')

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (isStaff !== 'true') {
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

    const updated = await db.portalUpload.update({
      where: { id },
      data: { review_status: body.review_status },
    })

    return NextResponse.json({ upload: updated }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/uploads/review] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
