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

interface TableConfig {
  bibleTable: string
  portalTable: string
  columns: Record<string, string>
  filter?: string
  // Optional per-row transform that augments or overrides the default column-copy
  // data object with derived fields (e.g. role heuristics, FK resolution).
  transform?: (row: Record<string, unknown>, data: Record<string, unknown>) => Record<string, unknown>
  // Skip the row if the transform returns null.
}

// -------------------------------------------------------------------------
// Value unpacking — the Bible stores some single-select cells as JSON blobs
// from its Baserow-style predecessor: {"id":3122,"value":"complete","color":"blue"}
// or just {"value":"complete"}. Strip them to the bare string value.
// -------------------------------------------------------------------------

function unpack(v: unknown): unknown {
  if (typeof v !== 'string') return v
  const trimmed = v.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return v
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string') {
      return parsed.value
    }
  } catch {}
  return v
}

// Some columns are booleans in the Bible (stored as 0/1 ints) but booleans in
// Prisma. Coerce numeric truthiness.
function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true'
  return false
}

// Infer a portal Role from a Bible people row. Bible has no explicit role
// column; use is_staff + company as heuristics, CREW as default.
function inferRole(row: Record<string, unknown>): 'STAFF' | 'CLIENT' | 'CREW' {
  if (asBool(row.is_staff)) return 'STAFF'
  if (row.company && String(row.company).trim()) return 'CLIENT'
  return 'CREW'
}

const TABLES: TableConfig[] = [
  {
    bibleTable: 'projects',
    portalTable: 'projects',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      job_number: 'job_number',
      status: 'status',
      phase: 'phase',
      client_portal_enabled: 'client_portal_enabled',
      client_visible: 'client_visible',
      crew_visible: 'crew_visible',
    },
    // Publish every project so Sam (STAFF) and participants see them; gating
    // happens at the portal-page level via portal_allowed / visibility flags.
    transform: (row, data) => ({
      ...data,
      name: row.name ?? 'Untitled project',
      status: unpack(row.status) ?? 'unknown',
      phase: unpack(row.phase) ?? 'Proposal',
      client_portal_enabled: asBool(row.client_portal_enabled),
      client_visible: asBool(row.client_visible),
      crew_visible: asBool(row.crew_visible),
    }),
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
    // Skip rows with no email — Prisma requires unique non-null email on Person.
    filter: "email IS NOT NULL AND TRIM(email) != ''",
    transform: (row, data) => ({
      ...data,
      name: (row.name ?? (`${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Unknown')),
      email: String(row.email).toLowerCase().trim(),
      is_staff: asBool(row.is_staff),
      portal_allowed: asBool(row.portal_allowed),
      role: inferRole(row),
    }),
  },
  {
    bibleTable: 'deliverables',
    portalTable: 'deliverables',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      deliverable_type: 'deliverable_type',
      description: 'description',
      due_date: 'due_date',
      review_status: 'review_status',
      client_approved: 'client_approved',
      delivered: 'delivered',
      delivered_date: 'delivered_date',
      client_visible: 'client_visible',
      dropbox_path: 'dropbox_path',
    },
  },
  {
    bibleTable: 'project_updates',
    portalTable: 'project_updates',
    columns: {
      id: 'source_bible_id',
      body: 'body',
      author: 'author',
      posted_at: 'posted_at',
    },
  },
  {
    bibleTable: 'change_orders',
    portalTable: 'change_orders',
    columns: {
      id: 'source_bible_id',
      description: 'description',
      status: 'status',
      cost_impact: 'cost_impact',
      proposed_at: 'proposed_at',
      approved_at: 'approved_at',
      approved_by: 'approved_by',
    },
  },
  {
    bibleTable: 'obligations',
    portalTable: 'obligations',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      description: 'description',
      amount: 'amount',
      due_date: 'due_date',
      paid_date: 'paid_date',
      status: 'status',
      type: 'type',
      category: 'category',
    },
  },
  {
    bibleTable: 'shoot_periods',
    portalTable: 'shoot_periods',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      start_date: 'start_date',
      end_date: 'end_date',
      period_type: 'period_type',
      description: 'description',
      call_time: 'call_time',
      wrap_time: 'wrap_time',
    },
  },
  {
    bibleTable: 'tasks',
    portalTable: 'tasks',
    columns: {
      id: 'source_bible_id',
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      phase: 'phase',
      due_date: 'due_date',
      completed_date: 'completed_date',
    },
  },
  {
    bibleTable: 'project_participants',
    portalTable: 'project_participants',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      participant_type: 'participant_type',
      role: 'role',
      rate_type: 'rate_type',
      rate_amount: 'rate_amount',
    },
  },
  {
    bibleTable: 'testimonials',
    portalTable: 'testimonials',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      quote_text: 'quote_text',
      context: 'context',
      date_received: 'date_received',
      permission_status: 'permission_status',
    },
  },
  {
    bibleTable: 'deliverable_reviews',
    portalTable: 'deliverable_reviews',
    columns: {
      id: 'source_bible_id',
      name: 'name',
      status: 'status',
      reviewed_at: 'reviewed_at',
      version: 'version',
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
  rows: Array<{ source_bible_id: number; source_bible_table: string; publication_version: number; data: Record<string, unknown> }>,
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

  // Tables that require FK resolution (project_id, person_id) are deferred
  // until the publish script can look up portal UUIDs for Bible FKs. For now
  // publish only the root tables (projects, people) so dashboards render with
  // real Bible-sourced content.
  const FK_DEFERRED = new Set([
    'deliverables', 'project_updates', 'change_orders', 'obligations',
    'shoot_periods', 'tasks', 'project_participants', 'testimonials',
    'deliverable_reviews',
  ])

  const tablesToPublish = values.table
    ? TABLES.filter(t => t.bibleTable === values.table)
    : TABLES.filter(t => !FK_DEFERRED.has(t.bibleTable))

  if (values.table && tablesToPublish.length === 0) {
    console.error(`Unknown table: ${values.table}. Available: ${TABLES.map(t => t.bibleTable).join(', ')}`)
    process.exit(1)
  }

  for (const config of tablesToPublish) {
    const bibleCols = Object.keys(config.columns).join(', ')
    let sql = `SELECT rowid, ${bibleCols} FROM ${config.bibleTable}`
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
    const upsertBatch: Array<{ source_bible_id: number; source_bible_table: string; publication_version: number; data: Record<string, unknown> }> = []

    for (const row of rows) {
      // better-sqlite3 does not surface `rowid` in returned objects by default.
      // Every Bible table uses `id INTEGER PRIMARY KEY` which equals rowid anyway.
      const bibleId = Number(row.id ?? row.rowid)
      if (!Number.isFinite(bibleId)) continue
      const rowIdStr = String(bibleId)
      currentRowIds.add(rowIdStr)

      let data: Record<string, unknown> = {}
      for (const [bibleCol, portalCol] of Object.entries(config.columns)) {
        if (portalCol === 'source_bible_id') continue
        data[portalCol] = unpack(row[bibleCol] ?? null)
      }

      if (config.transform) {
        data = config.transform(row, data)
      }

      const rowHash = hashRow(data)
      if (!newState.hashes[config.bibleTable]) newState.hashes[config.bibleTable] = {}
      newState.hashes[config.bibleTable][rowIdStr] = rowHash

      const prevHash = state.hashes[config.bibleTable]?.[rowIdStr]
      if (prevHash === rowHash && !values.full) continue

      // Portal publication_version is INT4; ms-epoch overflows. Use seconds.
      const version = Math.floor(Date.now() / 1000)
      upsertBatch.push({
        source_bible_id: bibleId,
        source_bible_table: config.bibleTable,
        publication_version: version,
        data,
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
          publication_version: Math.floor(Date.now() / 1000),
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
