import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const STALENESS_THRESHOLD_MINUTES = 120

function isBusinessHoursEastern(): boolean {
  const now = new Date()
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  )
  const day = eastern.getDay()
  const hour = eastern.getHours()
  return day >= 1 && day <= 5 && hour >= 8 && hour < 20
}

export async function GET(): Promise<NextResponse> {
  const lastRun = await db.publicationRun.findFirst({
    orderBy: { completed_at: 'desc' },
    select: {
      id: true,
      completed_at: true,
      status: true,
      duration_ms: true,
      total_processed: true,
      total_errors: true,
    },
  })

  const isBusinessHours = isBusinessHoursEastern()

  if (!lastRun) {
    return NextResponse.json({
      healthy: !isBusinessHours,
      last_run: null,
      minutes_since_last_run: null,
      staleness_threshold_minutes: STALENESS_THRESHOLD_MINUTES,
      is_business_hours: isBusinessHours,
    })
  }

  const minutesSinceLastRun = Math.floor(
    (Date.now() - lastRun.completed_at.getTime()) / 60_000,
  )

  const isStale = isBusinessHours && minutesSinceLastRun >= STALENESS_THRESHOLD_MINUTES
  const healthy = !isStale && lastRun.status !== 'failed'

  return NextResponse.json({
    healthy,
    last_run: {
      id: lastRun.id,
      completed_at: lastRun.completed_at.toISOString(),
      status: lastRun.status,
      duration_ms: lastRun.duration_ms,
      total_processed: lastRun.total_processed,
      total_errors: lastRun.total_errors,
    },
    minutes_since_last_run: minutesSinceLastRun,
    staleness_threshold_minutes: STALENESS_THRESHOLD_MINUTES,
    is_business_hours: isBusinessHours,
  })
}
