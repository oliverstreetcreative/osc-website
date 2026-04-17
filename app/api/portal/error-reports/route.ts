import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

const VALID_SEVERITIES = ['minor', 'moderate', 'blocking'] as const

export async function POST(req: NextRequest): Promise<NextResponse> {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, portal_allowed: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    project_id?: string
    source_table?: string
    source_bible_id?: number
    source_bible_table?: string
    portal_url?: string
    description?: string
    severity?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const severity = body.severity ?? 'moderate'
  if (!VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    return NextResponse.json(
      { error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` },
      { status: 400 },
    )
  }

  const report = await db.portalErrorReport.create({
    data: {
      reporter_id: person.id,
      project_id: body.project_id || null,
      source_table: body.source_table || null,
      source_bible_id: body.source_bible_id ?? null,
      source_bible_table: body.source_bible_table || null,
      portal_url: body.portal_url || null,
      description: body.description.trim(),
      severity,
    },
  })

  await db.portalEvent.create({
    data: {
      person_id: person.id,
      project_id: body.project_id || null,
      event_type: 'error_flagged',
      payload: JSON.stringify({
        report_id: report.id,
        source_table: body.source_table,
        severity,
        description: body.description.trim().slice(0, 200),
      }),
      source: 'portal_client',
    },
  })

  return NextResponse.json({ report }, { status: 201 })
}

export async function GET(): Promise<NextResponse> {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reports = await db.portalErrorReport.findMany({
    where: { reporter_id: userId },
    orderBy: { created_at: 'desc' },
    take: 50,
    include: {
      project: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ reports })
}
