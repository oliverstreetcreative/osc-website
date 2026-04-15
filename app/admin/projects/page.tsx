import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Projects — OSC Admin' }

export default async function AdminProjectsPage() {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const projects = await db.project.findMany({
    where: { client_portal_enabled: true },
    include: {
      _count: {
        select: {
          deliverables: true,
          participants: true,
        },
      },
    },
    orderBy: { updated_at: 'desc' },
  })

  return (
    <div style={{ maxWidth: '900px' }}>
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
          Projects
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {projects.length} portal-enabled project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

      {projects.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>
          No projects have client portal enabled.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 120px 120px 100px 80px 80px',
              gap: '12px',
              padding: '8px 16px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--quiet)',
              borderBottom: '1px solid rgba(138,138,132,0.2)',
            }}
          >
            <span>Name</span>
            <span>Job #</span>
            <span>Phase</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Deliverables</span>
            <span style={{ textAlign: 'right' }}>Participants</span>
          </div>

          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}/visibility`}
              style={{ textDecoration: 'none' }}
            >
              <Card
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(138,138,132,0.1)',
                  borderRadius: 0,
                  transition: 'background 0.1s',
                }}
              >
                <CardContent style={{ padding: '0' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 120px 120px 100px 80px 80px',
                      gap: '12px',
                      padding: '12px 16px',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--paper)',
                      }}
                    >
                      {p.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--quiet)', fontFamily: 'monospace' }}>
                      {p.job_number || '—'}
                    </span>
                    <span>
                      {p.phase ? (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {p.phase}
                        </Badge>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>—</span>
                      )}
                    </span>
                    <span>
                      {p.status ? (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {p.status}
                        </Badge>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>—</span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--paper)',
                        textAlign: 'right',
                      }}
                    >
                      {p._count.deliverables}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--paper)',
                        textAlign: 'right',
                      }}
                    >
                      {p._count.participants}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
