import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Admin Dashboard — OSC' }

export default async function AdminDashboardPage() {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const now = new Date()

  const [
    uploadCount,
    recentUploads,
    pendingEventCount,
    recentEvents,
    expiredInviteCount,
  ] = await Promise.all([
    db.portalUpload.count(),
    db.portalUpload.findMany({
      take: 5,
      orderBy: { uploaded_at: 'desc' },
      include: { project: { select: { name: true } } },
    }),
    db.portalEvent.count({ where: { processed_at: null } }),
    db.portalEvent.findMany({
      take: 10,
      orderBy: { occurred_at: 'desc' },
      include: { person: { select: { name: true, email: true } } },
    }),
    db.portalInvite.count({
      where: { expires_at: { lt: now }, accepted_at: null },
    }),
  ])

  const summaryCards = [
    { label: 'Uploads', value: uploadCount, note: 'total files', accent: 'var(--gold)' },
    { label: 'Pending Events', value: pendingEventCount, note: 'unprocessed', accent: '#e05c5c' },
    { label: 'Expired Invites', value: expiredInviteCount, note: 'need attention', accent: 'rgba(138,138,132,0.8)' },
  ]

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-garamond)',
            fontStyle: 'italic',
            fontSize: '28px',
            fontWeight: 400,
            marginBottom: '4px',
          }}
        >
          What needs you right now
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {formatDate(now)}
        </p>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}
      >
        {summaryCards.map((card) => (
          <Card
            key={card.label}
            style={{
              background: 'rgba(247,246,243,0.04)',
              border: '1px solid rgba(138,138,132,0.2)',
              borderTop: `3px solid ${card.accent}`,
            }}
          >
            <CardContent style={{ padding: '20px' }}>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: 'var(--paper)',
                  marginBottom: '6px',
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--paper)' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--quiet)', marginTop: '2px' }}>
                {card.note}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Recent uploads */}
        <Card
          style={{
            background: 'rgba(247,246,243,0.04)',
            border: '1px solid rgba(138,138,132,0.2)',
          }}
        >
          <CardHeader style={{ paddingBottom: '8px' }}>
            <CardTitle
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--quiet)',
              }}
            >
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentUploads.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>No uploads yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentUploads.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(138,138,132,0.1)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--paper)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {u.file_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--quiet)', marginTop: '2px' }}>
                      {u.project?.name ?? '—'} · {formatDate(u.uploaded_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card
          style={{
            background: 'rgba(247,246,243,0.04)',
            border: '1px solid rgba(138,138,132,0.2)',
          }}
        >
          <CardHeader style={{ paddingBottom: '8px' }}>
            <CardTitle
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--quiet)',
              }}
            >
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>No recent events.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentEvents.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(138,138,132,0.1)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: e.processed_at ? 'var(--quiet)' : '#e05c5c',
                        }}
                      >
                        {e.event_type}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--quiet)' }}>
                        {formatDate(e.occurred_at)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--paper)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.summary || e.event_type}
                    </div>
                    {e.person && (
                      <div style={{ fontSize: '11px', color: 'var(--quiet)', marginTop: '1px' }}>
                        {e.person.name || e.person.email}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
