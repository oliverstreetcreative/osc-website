#!/usr/bin/env npx tsx
import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { parseArgs } from 'node:util'

const BIBLE_PATH = process.env.BIBLE_PATH ??
  '/Volumes/84TB RAID5/Dropbox (Personal)/OLIVER STREET CREATIVE/_admin/bible.db'

const PUBLISH_URL = process.env.PUBLISH_URL ?? 'https://oliverstreetcreative.com/api/publish'
const PUBLISH_SECRET = process.env.PUBLISH_SECRET ?? ''

const STATE_PATH = process.env.PUBLISH_STATE_PATH ??
  '/Volumes/84TB RAID5/Dropbox (Personal)/OLIVER STREET CREATIVE/_admin/.publish-state.json'

// -------------------------------------------------------------------------
// Bible → Portal table mapping
// Each entry: Bible table, Portal table name (matching /api/publish TABLE_MAP),
// column map (bible_col → portal_col), and optional filter
// -------------------------------------------------------------------------

function tryUnpackBaserow(val: unknown): unknown {
  if (typeof val !== 'string') return val
  const trimmed = val.trim()
  if (!trimmed.startsWith('{') || !trimmed.includes('"value"')) return val
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && 'value' in parsed) return parsed.value
  } catch {}
  return val
}

function extractBaserowLinkId(val: unknown): number | null {
  if (typeof val !== 'string') return null
  try {
    const arr = JSON.parse(val)
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0].id === 'number') return arr[0].id
  } catch {}
  return null
}

function extractBaserowLinkValue(val: unknown): string | null {
  if (typeof val !== 'string') return null
  try {
    const arr = JSON.parse(val)
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0].value === 'string') return arr[0].value
  } catch {}
  return null
}

interface FkHint {
  bible_id: number
  bible_table: string
}

interface TableConfig {
  bibleTable: string
  portalTable: string
  columns: Record<string, string>
  filter?: string
  extraSelect?: string[]
  computeFields?: (row: Record<string, unknown>) => Record<string, unknown>
  fkColumns?: Record<string, { bibleCol: string; targetBibleTable: string }>
}

const TABLES: TableConfig[] = [
  // --- Root tables (no FK dependencies) ---
  {
    bibleTable: 'projects',
    portalTable: 'projects',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      job_number: 'job_number',
      status: 'status',
      project_phase: 'project_phase',
      shoot_start_date: 'shoot_start_date',
      shoot_end_date: 'shoot_end_date',
      delivery_date: 'delivery_date',
      client_portal_enabled: 'client_portal_enabled',
    },
    filter: "client_portal_enabled = 1 OR client_portal_enabled = 'true'",
  },
  {
    bibleTable: 'people',
    portalTable: 'persons',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email',
      company: 'company',
      phone: 'phone',
      is_staff: 'is_staff',
      portal_allowed: 'portal_allowed',
    },
    filter: 'portal_allowed = 1',
    extraSelect: ['clients'],
    computeFields: (row) => {
      const isStaff = row.is_staff === 1 || row.is_staff === '1' || row.is_staff === true
      let role: string = 'CREW'
      if (isStaff) {
        role = 'STAFF'
      } else {
        try {
          const clients = typeof row.clients === 'string' ? JSON.parse(row.clients) : row.clients
          if (Array.isArray(clients) && clients.length > 0) role = 'CLIENT'
        } catch {}
      }
      return {
        role,
        is_staff: isStaff,
        portal_allowed: Boolean(row.portal_allowed),
      }
    },
  },
  // --- FK-dependent tables (require project/person to exist first) ---
  {
    bibleTable: 'deliverables',
    portalTable: 'deliverables',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      deliverable_type: 'deliverable_type',
      description: 'description',
      client_visible: 'client_visible',
      review_status: 'review_status',
      current_version: 'current_version',
      shared_at: 'shared_at',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
  },
  {
    bibleTable: 'project_updates',
    portalTable: 'project_updates',
    columns: {
      id: 'source_bible_id',
      author: 'author',
      body: 'body',
      attachments: 'attachments',
      posted_at: 'posted_at',
      client_visible: 'client_visible',
      client_reply: 'client_reply',
      client_replied_at: 'client_replied_at',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
  },
  {
    bibleTable: 'change_orders',
    portalTable: 'change_orders',
    columns: {
      id: 'source_bible_id',
      description: 'description',
      cost_impact: 'cost_impact',
      status: 'status',
      client_visible: 'client_visible',
      proposed_at: 'proposed_at',
      approved_at: 'approved_at',
    },
    extraSelect: ['approved_by'],
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
    computeFields: (row) => ({
      approved_by: extractBaserowLinkValue(row.approved_by),
    }),
  },
  {
    bibleTable: 'obligations',
    portalTable: 'obligations',
    columns: {
      id: 'source_bible_id',
      type: 'type',
      status: 'status',
      amount: 'amount',
      description: 'description',
      obligation_date: 'obligation_date',
      due_date: 'due_date',
      paid_date: 'paid_date',
      client_visible: 'client_visible',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
  },
  {
    bibleTable: 'shoot_periods',
    portalTable: 'shoot_periods',
    columns: {
      id: 'source_bible_id',
      start_date: 'start_date',
      end_date: 'end_date',
      period_type: 'period_type',
      description: 'description',
      call_time: 'call_time',
      client_visible: 'client_visible',
      crew_visible: 'crew_visible',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
  },
  {
    bibleTable: 'tasks',
    portalTable: 'tasks',
    columns: {
      id: 'source_bible_id',
      title: 'title',
      status: 'status',
      priority: 'priority',
      phase: 'phase',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
    },
  },
  {
    bibleTable: 'project_participants',
    portalTable: 'project_participants',
    columns: {
      id: 'source_bible_id',
      role: 'role',
      crew_visible: 'crew_visible',
    },
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
      person_id: { bibleCol: 'person', targetBibleTable: 'people' },
    },
  },
  {
    bibleTable: 'testimonials',
    portalTable: 'testimonials',
    columns: {
      id: 'source_bible_id',
      quote_text: 'body',
      date_received: 'submitted_at',
    },
    extraSelect: ['permission_status'],
    fkColumns: {
      project_id: { bibleCol: 'project', targetBibleTable: 'projects' },
      person_id: { bibleCol: 'person', targetBibleTable: 'people' },
    },
    computeFields: (row) => {
      const status = tryUnpackBaserow(row.permission_status)
      return {
        approved: status === 'approved' || status === 'Approved',
      }
    },
  },
  {
    bibleTable: 'deliverable_reviews',
    portalTable: 'deliverable_reviews',
    columns: {
      id: 'source_bible_id',
      version: 'version',
      status: 'status',
      reviewed_at: 'reviewed_at',
    },
    fkColumns: {
      deliverable_id: { bibleCol: 'deliverable', targetBibleTable: 'deliverables' },
      reviewer_id: { bibleCol: 'reviewer', targetBibleTable: 'people' },
    },
  },
]

// -------------------------------------------------------------------------
// State tracking — hash-based change detection
// -------------------------------------------------------------------------

interface PublishState {
  lastRun: string
  hashes: Record<string, Record<string, string>> // table → rowId → hash
}

function loadState(): PublishState {
  try {
    const fs = require('fs')
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
  } catch {
    return { lastRun: '', hashes: {} }
  }
}

function saveState(state: PublishState) {
  const fs = require('fs')
  const path = require('path')
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function hashRow(row: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex')
}

// -------------------------------------------------------------------------
// Publishing
// -------------------------------------------------------------------------

interface PublishResult {
  processed: number
  created: number
  updated: number
  skipped: number
  revoked: number
  errors: Array<{ source_bible_id: number; error: string }>
}

async function publishBatch(
  portalTable: string,
  action: 'upsert' | 'revoke',
  rows: Array<{ source_bible_id: number; source_bible_table: string; publication_version: number; data: Record<string, unknown>; fk_hints?: Record<string, FkHint> }>,
): Promise<PublishResult> {
  const res = await fetch(PUBLISH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PUBLISH_SECRET}`,
    },
    body: JSON.stringify({ table: portalTable, action, rows }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Publish failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<PublishResult>
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

interface TableSummary {
  table: string
  processed: number
  created: number
  updated: number
  skipped: number
  revoked: number
  errors: number
}

async function logPublishRun(
  startedAt: Date,
  completedAt: Date,
  totals: { processed: number; created: number; updated: number; skipped: number; revoked: number; errors: number },
  tablesSummary: TableSummary[],
  triggeredBy: string,
): Promise<void> {
  const runsUrl = PUBLISH_URL.replace(/\/api\/publish$/, '/api/admin/publish-runs')
  const durationMs = completedAt.getTime() - startedAt.getTime()

  const status =
    totals.errors === 0
      ? 'success'
      : totals.processed > totals.errors
        ? 'partial'
        : 'failed'

  try {
    const res = await fetch(runsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUBLISH_SECRET}`,
      },
      body: JSON.stringify({
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        status,
        duration_ms: durationMs,
        tables_summary: tablesSummary,
        total_processed: totals.processed,
        total_created: totals.created,
        total_updated: totals.updated,
        total_skipped: totals.skipped,
        total_revoked: totals.revoked,
        total_errors: totals.errors,
        triggered_by: triggeredBy,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn(`[publish] Run logging failed (${res.status}): ${text}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[publish] Run logging error: ${msg}`)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      full: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      table: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      'triggered-by': { type: 'string', default: 'cron' },
    },
  })

  if (values.help) {
    console.log(`
publish.ts — Sync Bible data to Portal DB via /api/publish

Usage:
  npx tsx scripts/publish.ts [options]

Options:
  --full       Republish all rows (ignore change detection)
  --dry-run    Show what would be published without sending
  --table NAME Only publish a specific table (bible table name)
  --json          Output results as JSON
  --triggered-by  Tag the run source (cron, manual, on_demand; default: cron)
  --help          Show this help

Environment:
  BIBLE_PATH        Path to bible.db (default: Dropbox path)
  PUBLISH_URL       URL of /api/publish endpoint
  PUBLISH_SECRET    Bearer token for /api/publish
  PUBLISH_STATE_PATH  Path to state file for change tracking
`)
    process.exit(0)
  }

  if (!PUBLISH_SECRET) {
    console.error('Error: PUBLISH_SECRET environment variable is required')
    process.exit(1)
  }

  const startedAt = new Date()

  const db = new Database(BIBLE_PATH, { readonly: true })
  const state = values.full ? { lastRun: '', hashes: {} } : loadState()
  const newState: PublishState = { lastRun: new Date().toISOString(), hashes: {} }

  const totals = { processed: 0, created: 0, updated: 0, skipped: 0, revoked: 0, errors: 0 }
  const tablesSummary: TableSummary[] = []
  const BATCH_SIZE = 50

  const tablesToPublish = values.table
    ? TABLES.filter(t => t.bibleTable === values.table)
    : TABLES

  if (values.table && tablesToPublish.length === 0) {
    console.error(`Unknown table: ${values.table}. Available: ${TABLES.map(t => t.bibleTable).join(', ')}`)
    process.exit(1)
  }

  for (const config of tablesToPublish) {
    const bibleCols = Object.keys(config.columns).join(', ')
    const fkCols = config.fkColumns ? Object.values(config.fkColumns).map(fk => fk.bibleCol) : []
    const allExtraCols = [...(config.extraSelect ?? []), ...fkCols]
    const extraCols = allExtraCols.length ? ', ' + Array.from(new Set(allExtraCols)).join(', ') : ''
    let sql = `SELECT rowid, ${bibleCols}${extraCols} FROM ${config.bibleTable}`
    if (config.filter) sql += ` WHERE ${config.filter}`

    let rows: Record<string, unknown>[]
    try {
      rows = db.prepare(sql).all() as Record<string, unknown>[]
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Error reading ${config.bibleTable}: ${msg}`)
      continue
    }

    const tableSummary: TableSummary = {
      table: config.bibleTable,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      revoked: 0,
      errors: 0,
    }

    const currentRowIds = new Set<string>()
    const upsertBatch: Array<{ source_bible_id: number; source_bible_table: string; publication_version: number; data: Record<string, unknown>; fk_hints?: Record<string, FkHint> }> = []

    for (const row of rows) {
      const bibleId = Number(row.rowid)
      const rowIdStr = String(bibleId)
      currentRowIds.add(rowIdStr)

      const data: Record<string, unknown> = {}
      for (const [bibleCol, portalCol] of Object.entries(config.columns)) {
        if (portalCol === 'source_bible_id') continue
        data[portalCol] = tryUnpackBaserow(row[bibleCol]) ?? null
      }

      if (config.computeFields) {
        Object.assign(data, config.computeFields(row))
      }

      let fk_hints: Record<string, FkHint> | undefined
      if (config.fkColumns) {
        fk_hints = {}
        for (const [portalCol, fkDef] of Object.entries(config.fkColumns)) {
          const linkedId = extractBaserowLinkId(row[fkDef.bibleCol])
          if (linkedId !== null) {
            fk_hints[portalCol] = { bible_id: linkedId, bible_table: fkDef.targetBibleTable }
          }
        }
        if (Object.keys(fk_hints).length === 0) fk_hints = undefined
      }

      const rowHash = hashRow({ ...data, ...fk_hints })
      if (!newState.hashes[config.bibleTable]) newState.hashes[config.bibleTable] = {}
      newState.hashes[config.bibleTable][rowIdStr] = rowHash

      const prevHash = state.hashes[config.bibleTable]?.[rowIdStr]
      if (prevHash === rowHash && !values.full) continue

      const version = Date.now()
      upsertBatch.push({
        source_bible_id: bibleId,
        source_bible_table: config.bibleTable,
        publication_version: version,
        data,
        fk_hints,
      })
    }

    // Detect revocations: rows that were in previous state but not in current
    const revokeBatch: typeof upsertBatch = []
    const prevRows = state.hashes[config.bibleTable] ?? {}
    for (const prevId of Object.keys(prevRows)) {
      if (!currentRowIds.has(prevId)) {
        revokeBatch.push({
          source_bible_id: Number(prevId),
          source_bible_table: config.bibleTable,
          publication_version: Date.now(),
          data: {},
        })
      }
    }

    if (!values.json) {
      const changeCount = upsertBatch.length + revokeBatch.length
      if (changeCount > 0) {
        console.log(`${config.bibleTable}: ${upsertBatch.length} upsert, ${revokeBatch.length} revoke (of ${rows.length} total rows)`)
      }
    }

    if (values['dry-run']) {
      totals.processed += upsertBatch.length + revokeBatch.length
      continue
    }

    // Send upserts in batches
    for (let i = 0; i < upsertBatch.length; i += BATCH_SIZE) {
      const batch = upsertBatch.slice(i, i + BATCH_SIZE)
      try {
        const result = await publishBatch(config.portalTable, 'upsert', batch)
        totals.processed += result.processed
        totals.created += result.created
        totals.updated += result.updated
        totals.skipped += result.skipped
        totals.errors += result.errors.length
        tableSummary.processed += result.processed
        tableSummary.created += result.created
        tableSummary.updated += result.updated
        tableSummary.skipped += result.skipped
        tableSummary.errors += result.errors.length
        if (result.errors.length > 0 && !values.json) {
          for (const e of result.errors) {
            console.error(`  Error on ${config.bibleTable} id=${e.source_bible_id}: ${e.error}`)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Publish error for ${config.bibleTable}: ${msg}`)
        totals.errors++
        tableSummary.errors++
      }
    }

    // Send revocations
    for (let i = 0; i < revokeBatch.length; i += BATCH_SIZE) {
      const batch = revokeBatch.slice(i, i + BATCH_SIZE)
      try {
        const result = await publishBatch(config.portalTable, 'revoke', batch)
        totals.revoked += result.revoked
        tableSummary.revoked += result.revoked
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Revoke error for ${config.bibleTable}: ${msg}`)
        totals.errors++
        tableSummary.errors++
      }
    }

    tablesSummary.push(tableSummary)
  }

  db.close()

  if (!values['dry-run']) {
    saveState(newState)
  }

  const completedAt = new Date()

  if (!values['dry-run']) {
    await logPublishRun(
      startedAt,
      completedAt,
      totals,
      tablesSummary,
      values['triggered-by'] ?? 'cron',
    )
  }

  if (values.json) {
    console.log(JSON.stringify(totals))
  } else {
    console.log(`\nDone. Processed: ${totals.processed}, Created: ${totals.created}, Updated: ${totals.updated}, Skipped: ${totals.skipped}, Revoked: ${totals.revoked}, Errors: ${totals.errors}`)
  }

  process.exit(totals.errors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
