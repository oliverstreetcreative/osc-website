import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'

export const metadata = { title: 'My Reports — OSC Crew Portal' }

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------
function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'open':
      return {
        background: 'rgba(242,193,78,0.12)',
        color: '#f2c14e',
        border: '1px solid rgba(242,193,78,0.35)',
      }
    case 'triaged':
    case 'in_progress':
      return {
        background: 'rgba(100,160,240,0.12)',
        color: '#64a0f0',
        border: '1px solid rgba(100,160,240,0.35)',
      }
    case 'resolved':
      return {
        background: 'rgba(58,138,92,0.12)',
        color: '#3a8a5c',
        border: '1px solid rgba(58,138,92,0.35)',
      }
    case 'invalid':
    case 'closed':
    default:
      return {
        background: 'rgba(138,138,132,0.12)',
        color: 'var(--quiet)',
        border: '1px solid rgba(138,138,132,0.25)',
      }
  }
}

// ---------------------------------------------------------------------------
// Severity badge colors
// ---------------------------------------------------------------------------
function severityStyle(severity: string): React.CSSProperties {
  switch (severity) {
    case 'blocking':
      return {
        background: 'rgba(224,92,92,0.12)',
        color: '#e05c5c',
        border: '1px solid rgba(224,92,92,0.35)',
      }
    case 'moderate':
      return {
        background: 'rgba(242,193,78,0.12)',
        color: '#f2c14e',
        border: '1px solid rgba(242,193,78,0.35)',
      }
    case 'minor':
    default:
      return {
        background: 'rgba(138,138,132,0.12)',
        color: 'var(--quiet)',
        border: '1px solid rgba(138,138,132,0.25)',
      }
  }
}

function Badge({
  children,
  extraStyle,
}: {
  children: React.ReactNode
  extraStyle: React.CSSProperties
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '2px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </span>
  )
}

export default async function CrewIssuesPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const reports = await db.portalErrorReport.findMany({
    where: { reporter_id: user.id },
    orderBy: { created_at: 'desc' },
    take: 50,
    include: {
      project: { select: { id: true, name: true } },
    },
  })

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-garamond)',
            fontStyle: 'italic',
            fontSize: '28px',
            fontWeight: 400,
            marginBottom: '4px',
          }}
        >
          My Reports
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {reports.length} report{reports.length !== 1 ? 's' : ''} submitted
        </p>
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: 'var(--quiet)',
          }}
        >
          <p style={{ fontSize: '15px' }}>No reports yet.</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            Use the flag button on any page to report an issue.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            borderTop: '1px solid rgba(138,138,132,0.2)',
          }}
        >
          {reports.map((report: (typeof reports)[number]) => (
            <div
              key={report.id}
              style={{
                padding: '16px 0',
                borderBottom: '1px solid rgba(138,138,132,0.1)',
              }}
            >
              {/* Top row: description */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--paper)',
                  marginBottom: '8px',
                  lineHeight: '1.5',
                }}
              >
                {report.description}
              </div>

              {/* Meta row: badges + project + date */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <Badge extraStyle={severityStyle(report.severity)}>
                  {report.severity}
                </Badge>
                <Badge extraStyle={statusStyle(report.status)}>
                  {report.status.replace('_', ' ')}
                </Badge>

                {report.project && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--quiet)',
                      marginLeft: '4px',
                    }}
                  >
                    {report.project.name}
                  </span>
                )}

                <span
                  style={{
                    fontSize: '12px',
                    color: 'rgba(138,138,132,0.6)',
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDate(report.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
