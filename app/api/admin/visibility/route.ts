import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Allowed tables and their Prisma delegate keys
// ---------------------------------------------------------------------------

const TABLE_MAP: Record<string, string> = {
  deliverables:    'deliverable',
  project_updates: 'projectUpdate',
  change_orders:   'changeOrder',
  obligations:     'obligation',
  shoot_periods:   'shootPeriod',
  tasks:           'task',
}

const ALLOWED_FIELDS = ['client_visible', 'crew_visible'] as const
type VisibilityField = (typeof ALLOWED_FIELDS)[number]

interface VisibilityBody {
  table:  string
  row_id: string
  field:  VisibilityField
  value:  boolean
}

// ---------------------------------------------------------------------------
// POST /api/admin/visibility
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const headersList = await headers()
  const userId    = headersList.get('x-user-id')
  const isStaff   = headersList.get('x-user-is-staff')

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (isStaff !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse body
  let body: VisibilityBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { table, row_id, field, value } = body

  if (!table || !row_id || !field || typeof value !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: table, row_id, field, value' },
      { status: 400 },
    )
  }

  // 3. Validate table
  const modelName = TABLE_MAP[table]
  if (!modelName) {
    return NextResponse.json(
      { error: `Unknown table: ${table}. Allowed: ${Object.keys(TABLE_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  // 4. Validate field
  if (!ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json(
      { error: `Invalid field: ${field}. Must be 'client_visible' or 'crew_visible'` },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[modelName]

  try {
    // 5. Update the record
    const updated = await delegate.update({
      where: { id: row_id },
      data:  { [field]: value },
    })

    // 6. Create portal_event
    await db.portalEvent.create({
      data: {
        person_id:  userId,
        project_id: updated.project_id,
        event_type: 'visibility_flip',
        summary:    `Admin toggled ${field} on ${table}`,
        source:     'portal_admin',
        details:    { table, row_id, field, value },
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/visibility] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
