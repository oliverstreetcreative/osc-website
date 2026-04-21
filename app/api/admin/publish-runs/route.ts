import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function authenticate(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const secret = process.env.PUBLISH_SECRET
  return Boolean(secret && token === secret)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    started_at: string
    completed_at: string
    status: string
    duration_ms: number
    tables_summary: unknown
    total_processed: number
    total_created: number
    total_updated: number
    total_skipped: number
    total_revoked: number
    total_errors: number
    error_details?: string
    triggered_by?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    started_at,
    completed_at,
    status,
    duration_ms,
    tables_summary,
    total_processed,
    total_created,
    total_updated,
    total_skipped,
    total_revoked,
    total_errors,
    error_details,
    triggered_by,
  } = body

  if (!started_at || !completed_at || !status || duration_ms == null || !tables_summary) {
    return NextResponse.json(
      { error: 'Missing required fields: started_at, completed_at, status, duration_ms, tables_summary' },
      { status: 400 },
    )
  }

  const run = await db.publicationRun.create({
    data: {
      started_at: new Date(started_at),
      completed_at: new Date(completed_at),
      status,
      duration_ms,
      tables_summary,
      total_processed: total_processed ?? 0,
      total_created: total_created ?? 0,
      total_updated: total_updated ?? 0,
      total_skipped: total_skipped ?? 0,
      total_revoked: total_revoked ?? 0,
      total_errors: total_errors ?? 0,
      error_details: error_details ?? null,
      triggered_by: triggered_by ?? 'cron',
    },
  })

  return NextResponse.json(run, { status: 201 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runs = await db.publicationRun.findMany({
    take: 20,
    orderBy: { completed_at: 'desc' },
  })

  return NextResponse.json(runs)
}
