#!/usr/bin/env npx tsx
import { parseArgs } from 'node:util'

const PUBLISH_URL = process.env.PUBLISH_URL ?? 'https://oliverstreetcreative.com'
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''

const ALERT_TO = 'oliverstreetmedia@gmail.com'
const ALERT_FROM = 'Oliver Street Creative <portal@oliverstreetcreative.com>'
const ALERT_SUBJECT = '[OSC Portal] Publication pipeline stale'

interface HealthResponse {
  healthy: boolean
  last_run: {
    id: string
    completed_at: string
    status: string
    duration_ms: number
    total_processed: number
    total_errors: number
  } | null
  minutes_since_last_run: number | null
  staleness_threshold_minutes: number
  is_business_hours: boolean
}

async function fetchHealth(): Promise<HealthResponse> {
  const url = `${PUBLISH_URL.replace(/\/$/, '')}/api/admin/publish-health`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status}): ${await res.text()}`)
  }
  return res.json() as Promise<HealthResponse>
}

function buildAlertBody(health: HealthResponse): string {
  const lines: string[] = [
    'The OSC Portal publication pipeline appears to be stale.',
    '',
  ]

  if (health.last_run) {
    const r = health.last_run
    lines.push(`Last run completed: ${r.completed_at}`)
    lines.push(`Status: ${r.status}`)
    lines.push(`Duration: ${(r.duration_ms / 1000).toFixed(1)}s`)
    lines.push(`Rows processed: ${r.total_processed}`)
    lines.push(`Errors: ${r.total_errors}`)
    lines.push('')
    lines.push(`Minutes since last run: ${health.minutes_since_last_run}`)
    lines.push(`Staleness threshold: ${health.staleness_threshold_minutes} minutes`)
  } else {
    lines.push('No publication runs have been recorded.')
  }

  lines.push('')
  lines.push('What to do:')
  lines.push('  1. Check that the publish cron job is running on the host machine.')
  lines.push('  2. Review recent logs: npx tsx scripts/publish.ts --json')
  lines.push('  3. Verify BIBLE_PATH, PUBLISH_URL, and PUBLISH_SECRET are set correctly.')
  lines.push('  4. Check the portal admin dashboard for run history.')
  lines.push('')
  lines.push(`Dashboard: ${PUBLISH_URL.replace(/\/$/, '')}/admin`)

  return lines.join('\n')
}

async function sendAlert(health: HealthResponse): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  const body = buildAlertBody(health)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: ALERT_FROM,
      to: [ALERT_TO],
      subject: ALERT_SUBJECT,
      text: body,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend API error (${res.status}): ${text}`)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    console.log(`
publish-monitor.ts — Check publication pipeline health and alert if stale

Usage:
  npx tsx scripts/publish-monitor.ts [options]

Options:
  --json   Output result as JSON
  --help   Show this help

Environment:
  PUBLISH_URL      Base URL of the portal (default: https://oliverstreetcreative.com)
  RESEND_API_KEY   Resend API key for sending alert emails

Exit codes:
  0  Pipeline is healthy
  1  Pipeline is stale — alert email sent
  2  Error occurred
`)
    process.exit(0)
  }

  let health: HealthResponse
  try {
    health = await fetchHealth()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (values.json) {
      console.log(JSON.stringify({ error: msg }))
    } else {
      console.error(`Error fetching health: ${msg}`)
    }
    process.exit(2)
  }

  if (health.healthy) {
    if (values.json) {
      console.log(JSON.stringify({ healthy: true, health }))
    } else {
      const since = health.minutes_since_last_run != null
        ? ` (${health.minutes_since_last_run}m ago)`
        : ''
      console.log(`Pipeline healthy. Last run: ${health.last_run?.status ?? 'none'}${since}`)
    }
    process.exit(0)
  }

  try {
    await sendAlert(health)
    if (values.json) {
      console.log(JSON.stringify({ healthy: false, alert_sent: true, health }))
    } else {
      console.log(`Pipeline stale. Alert sent to ${ALERT_TO}.`)
    }
    process.exit(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (values.json) {
      console.log(JSON.stringify({ healthy: false, alert_sent: false, error: msg, health }))
    } else {
      console.error(`Pipeline stale but failed to send alert: ${msg}`)
    }
    process.exit(2)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
