import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Table map: snake_case @@map name → Prisma delegate accessor key
// ---------------------------------------------------------------------------

const TABLE_MAP: Record<string, string> = {
  persons:               'person',
  projects:              'project',
  project_contacts:      'projectContact',
  project_participants:  'projectParticipant',
  deliverables:          'deliverable',
  deliverable_reviews:   'deliverableReview',
  deliverable_approvals: 'deliverableApproval',
  project_updates:       'projectUpdate',
  change_orders:         'changeOrder',
  obligations:           'obligation',
  shoot_periods:         'shootPeriod',
  trips:                 'trip',
  tasks:                 'task',
  portal_uploads:        'portalUpload',
  testimonials:          'testimonial',
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface FkHint {
  bible_id:    number
  bible_table: string
}

interface PublishRow {
  source_bible_id:      number
  source_bible_table:   string
  publication_version:  number
  data:                 Record<string, unknown>
  fk_hints?:            Record<string, FkHint>
}

interface PublishBody {
  table:  string
  action: 'upsert' | 'revoke'
  rows:   PublishRow[]
}

interface PublishResult {
  processed: number
  created:   number
  updated:   number
  skipped:   number
  revoked:   number
  errors:    Array<{ source_bible_id: number; error: string }>
}

// ---------------------------------------------------------------------------
// FK resolution: bible_table → Prisma model accessor
// ---------------------------------------------------------------------------

const BIBLE_TABLE_TO_MODEL: Record<string, string> = {
  projects:     'project',
  people:       'person',
  deliverables: 'deliverable',
}

async function resolveFkHints(
  fkHints: Record<string, FkHint>,
): Promise<{ resolved: Record<string, string>; errors: string[] }> {
  const resolved: Record<string, string> = {}
  const errors: string[] = []

  for (const [targetCol, hint] of Object.entries(fkHints)) {
    const modelName = BIBLE_TABLE_TO_MODEL[hint.bible_table]
    if (!modelName) {
      errors.push(`Unknown FK target table: ${hint.bible_table} for ${targetCol}`)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (db as any)[modelName]
    const record = await delegate.findFirst({
      where: { source_bible_id: hint.bible_id, source_bible_table: hint.bible_table },
      select: { id: true },
    })
    if (record) {
      resolved[targetCol] = record.id
    } else {
      errors.push(`${targetCol}: no ${hint.bible_table} record with source_bible_id=${hint.bible_id}`)
    }
  }

  return { resolved, errors }
}

// ---------------------------------------------------------------------------
// POST /api/publish
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const secret = process.env.PUBLISH_SECRET

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: PublishBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { table, action, rows } = body

  if (!table || !action || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: 'Missing required fields: table, action, rows' },
      { status: 400 },
    )
  }

  const modelName = TABLE_MAP[table]
  if (!modelName) {
    return NextResponse.json(
      { error: `Unknown table: ${table}. Supported: ${Object.keys(TABLE_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[modelName]
  if (!delegate) {
    return NextResponse.json(
      { error: `Prisma delegate not found for model: ${modelName}` },
      { status: 500 },
    )
  }

  // 3. Process rows
  const result: PublishResult = {
    processed: 0,
    created:   0,
    updated:   0,
    skipped:   0,
    revoked:   0,
    errors:    [],
  }

  for (const row of rows) {
    const { source_bible_id, source_bible_table, publication_version, data, fk_hints } = row
    result.processed++

    try {
      if (action === 'revoke') {
        await delegate.deleteMany({
          where: { source_bible_id, source_bible_table },
        })
        result.revoked++
        continue
      }

      // Resolve FK hints to portal UUIDs
      if (fk_hints && Object.keys(fk_hints).length > 0) {
        const { resolved, errors: fkErrors } = await resolveFkHints(fk_hints)
        if (fkErrors.length > 0) {
          result.errors.push({ source_bible_id, error: `FK resolution: ${fkErrors.join('; ')}` })
          continue
        }
        Object.assign(data, resolved)
      }

      // action === 'upsert'
      const existing = await delegate.findFirst({
        where: { source_bible_id, source_bible_table },
        select: { id: true, publication_version: true },
      })

      if (existing) {
        if (publication_version <= existing.publication_version) {
          result.skipped++
          continue
        }

        await delegate.update({
          where: { id: existing.id },
          data: {
            ...data,
            publication_version,
            published_at: new Date(),
          },
        })
        result.updated++
      } else {
        await delegate.create({
          data: {
            id: randomUUID(),
            ...data,
            source_bible_id,
            source_bible_table,
            publication_version,
            published_at: new Date(),
          },
        })
        result.created++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[publish] Error on ${table} source_bible_id=${source_bible_id}:`, message)
      result.errors.push({ source_bible_id, error: message })
    }
  }

  return NextResponse.json(result, { status: 200 })
}
