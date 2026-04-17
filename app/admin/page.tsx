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
    lastPublishRun,
    recentPublishRuns,
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
    db.publicationRun.findFirst({
      orderBy: { completed_at: 'desc' },
    }),
    db.publicationRun.findMany({
      take: 5,
      orderBy: { completed_at: 'desc' },
    }),
  ])

  function relativeTime(date: Date): string {
    const diffMs = now.getTime() - date.getTime()
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  function statusColor(status: string): string {
    if (status === 'success') return '#4caf6e'
    if (status === 'partial') return '#d4a017'
    return '#e05c5c'
  }

  const pipelineNote = lastPublishRun
    ? `${relativeTime(lastPublishRun.completed_at)} · ${lastPublishRun.total_processed} rows`
    : 'no runs recorded'

  const pipelineAccent = lastPublishRun
    ? statusColor(lastPublishRun.status)
    : 'rgba(138,138,132,0.8)'

  const summaryCards = [
    { label: 'Uploads', value: uploadCount, note: 'total files', accent: 'var(--gold)' },
    { label: 'Pending Events', value: pendingEventCount, note: 'unprocessed', accent: '#e05c5c' },
    { label: 'Expired Invites', value: expiredInviteCount, note: 'need attention', accent: 'rgba(138,138,132,0.8)' },
    {
      label: 'Publication Pipeline',
      value: lastPublishRun ? lastPublishRun.status : '—',
      note: pipelineNote,
      accent: pipelineAccent,
    },
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

      {/* Publication runs */}
      <Card
        style={{
          marginTop: '24px',
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
            Last 5 Publication Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPublishRuns.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>No runs recorded yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Time', 'Status', 'Duration', 'Processed', 'Errors'].map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--quiet)',
                        paddingBottom: '8px',
                        paddingRight: '16px',
                        borderBottom: '1px solid rgba(138,138,132,0.15)',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPublishRuns.map((run) => (
                  <tr key={run.id}>
                    <td
                      style={{
                        padding: '8px 16px 8px 0',
                        color: 'var(--paper)',
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      {relativeTime(run.completed_at)}
                    </td>
                    <td
                      style={{
                        padding: '8px 16px 8px 0',
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--paper)',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: statusColor(run.status),
                            flexShrink: 0,
                          }}
                        />
                        {run.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 16px 8px 0',
                        color: 'var(--paper)',
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      {(run.duration_ms / 1000).toFixed(1)}s
                    </td>
                    <td
                      style={{
                        padding: '8px 16px 8px 0',
                        color: 'var(--paper)',
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      {run.total_processed}
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        color: run.total_errors > 0 ? '#e05c5c' : 'var(--quiet)',
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      {run.total_errors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
