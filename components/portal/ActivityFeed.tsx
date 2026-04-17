'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'

const LAST_SEEN_KEY = 'osc_activity_lastSeen'
const POLL_INTERVAL_MS = 30_000

type PortalEvent = {
  id: string
  event_type: string
  summary: string
  occurred_at: string
  source: string
  project_id: string | null
  person_id: string | null
}

function eventIcon(eventType: string): string {
  switch (eventType) {
    case 'deliverable_approved':
      return '✓'
    case 'change_order_approved':
      return '⚡'
    case 'message_posted':
      return '💬'
    case 'upload_completed':
      return '📎'
    case 'task_checked':
    case 'task_unchecked':
      return '☑'
    case 'visibility_flip':
      return '👁'
    case 'payment_link_requested':
      return '💰'
    default:
      return '•'
  }
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function ActivityFeed() {
  const [events, setEvents] = useState<PortalEvent[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/activity')
      if (!res.ok) return
      const data: { events: PortalEvent[] } = await res.json()
      setEvents(data.events)

      // Compute unread count from localStorage
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
      if (lastSeen) {
        const lastSeenTime = new Date(lastSeen).getTime()
        const unread = data.events.filter(
          (e) => new Date(e.occurred_at).getTime() > lastSeenTime,
        ).length
        setUnreadCount(unread)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Update lastSeen on mount
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
    fetchEvents()

    const interval = setInterval(fetchEvents, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return (
    <div
      style={{
        borderTop: '1px solid rgba(138,138,132,0.15)',
        marginTop: 'auto',
        padding: '16px 12px 12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--quiet)',
          }}
        >
          Activity
        </span>
        {unreadCount > 0 && (
          <Badge
            variant="secondary"
            style={{
              fontSize: '10px',
              padding: '0 5px',
              height: '16px',
              background: 'var(--paper)',
              color: 'var(--ink)',
              borderRadius: '8px',
            }}
          >
            {unreadCount}
          </Badge>
        )}
      </div>

      {/* Event list */}
      {loading ? (
        <div style={{ fontSize: '11px', color: 'var(--quiet)', opacity: 0.5 }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--quiet)', fontStyle: 'italic', opacity: 0.6 }}>
          All caught up
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                gap: '7px',
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  flexShrink: 0,
                  width: '14px',
                  textAlign: 'center',
                  color: 'var(--paper)',
                  opacity: 0.7,
                }}
              >
                {eventIcon(event.event_type)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--paper)',
                    lineHeight: '14px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: 0.85,
                  }}
                  title={event.summary}
                >
                  {event.summary}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--quiet)',
                    marginTop: '1px',
                    opacity: 0.6,
                  }}
                >
                  {relativeTime(event.occurred_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
