import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, SeverityBadge } from '@/components/portal/error-report-shared'

export const metadata = {
  title: 'Issue Reports — OSC Crew Portal',
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
    include: { project: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 900,
            fontSize: 'clamp(22px, 4vw, 32px)',
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}
        >
          Issue Reports
        </h1>
        <p style={{ color: 'var(--quiet)', fontSize: '15px' }}>
          Reports you have submitted. The production team reviews every issue.
        </p>
      </div>

      {reports.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: 'var(--quiet)',
          }}
        >
          <p style={{ fontSize: '16px' }}>No issue reports yet.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Use the flag icon on any page to report something that looks wrong.
          </p>
        </div>
      ) : (
        <Card
          style={{
            background: 'rgba(247,246,243,0.04)',
            border: '1px solid rgba(138,138,132,0.2)',
          }}
        >
          <CardHeader style={{ paddingBottom: '12px' }}>
            <CardTitle
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--quiet)',
              }}
            >
              {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
            </CardTitle>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(138,138,132,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {/* Top row: description + badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--paper)',
                    }}
                  >
                    {report.description}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <SeverityBadge severity={report.severity} />
                    <StatusBadge status={report.status} />
                  </div>
                </div>

                {/* Bottom row: meta */}
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'var(--quiet)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{formatDate(report.created_at)}</span>
                  {report.project && <span>{report.project.name}</span>}
                  {report.source_table && <span>{report.source_table}</span>}
                  {report.portal_url && (
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '260px',
                      }}
                    >
                      {report.portal_url}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
