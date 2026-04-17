import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'

export const metadata = { title: 'Impersonation Audit | OSC Admin' }

export default async function ImpersonationAuditPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }
  if (!user.is_staff) redirect('/login')

  const events = await db.portalEvent.findMany({
    where: {
      event_type: {
        in: [
          'admin_impersonation_start',
          'admin_impersonation_end',
          'admin_impersonation_pageview',
        ],
      },
    },
    orderBy: { occurred_at: 'desc' },
    take: 200,
    include: {
      person: { select: { name: true, email: true } },
    },
  })

  function formatDate(d: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(d))
  }

  function eventLabel(eventType: string): { label: string; color: string } {
    switch (eventType) {
      case 'admin_impersonation_start':
        return { label: 'Started', color: '#f59e0b' }
      case 'admin_impersonation_end':
        return { label: 'Ended', color: '#34d399' }
      case 'admin_impersonation_pageview':
        return { label: 'Page View', color: '#94a3b8' }
      default:
        return { label: eventType, color: '#94a3b8' }
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-garamond)',
          fontStyle: 'italic',
          fontSize: '28px',
          fontWeight: 400,
          color: 'var(--paper)',
          margin: '0 0 8px 0',
        }}
      >
        Impersonation Audit Log
      </h1>
      <p style={{ color: 'var(--quiet)', fontSize: '14px', margin: '0 0 28px 0' }}>
        All admin impersonation sessions, showing the last 200 events.
      </p>

      {events.length === 0 ? (
        <p style={{ color: 'var(--quiet)', fontSize: '14px' }}>No impersonation events recorded.</p>
      ) : (
        <div
          style={{
            border: '1px solid rgba(138,138,132,0.2)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 150px 150px 100px 1fr',
              gap: '0',
              background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(138,138,132,0.2)',
              padding: '10px 20px',
            }}
          >
            {['Date', 'Admin', 'Target', 'Action', 'Details'].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--quiet)',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {events.map((event, idx) => {
            const { label, color } = eventLabel(event.event_type)
            const details = event.details as Record<string, unknown> | null
            const targetName =
              typeof details?.target_name === 'string' ? details.target_name : '—'
            const path =
              typeof details?.path === 'string' ? details.path : null

            return (
              <div
                key={event.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 150px 150px 100px 1fr',
                  gap: '0',
                  padding: '11px 20px',
                  alignItems: 'center',
                  borderBottom:
                    idx === events.length - 1
                      ? 'none'
                      : '1px solid rgba(138,138,132,0.1)',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  {formatDate(event.occurred_at)}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--paper)' }}>
                  {event.person?.name ?? '—'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--paper)' }}>
                  {targetName}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  {path ?? event.summary}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
