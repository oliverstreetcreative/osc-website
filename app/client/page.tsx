import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Dashboard — OSC Client Portal',
}

export default async function ClientDashboardPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Fetch projects this person is a participant on with portal enabled
  const participants = await db.projectParticipant.findMany({
    where: {
      person_id: user.id,
      project: { client_portal_enabled: true },
    },
    include: {
      project: true,
    },
    orderBy: { project: { published_at: 'desc' } },
  })

  const projects = participants.map((p) => p.project)
  const projectIds = projects.map((p) => p.id)

  // Deliverables needing review
  const pendingDeliverables = projectIds.length
    ? await db.deliverable.findMany({
        where: {
          project_id: { in: projectIds },
          client_visible: true,
          review_status: 'Pending Review',
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { shared_at: 'desc' },
        take: 10,
      })
    : []

  // Recent obligations (receivables = client invoices)
  const obligations = projectIds.length
    ? await db.obligation.findMany({
        where: {
          project_id: { in: projectIds },
          type: 'receivable',
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { obligation_date: 'desc' },
        take: 6,
      })
    : []

  // Projects eligible for a testimonial (Delivered/Complete phases, no existing testimonial)
  const existingTestimonials = projectIds.length
    ? await db.testimonial.findMany({
        where: { person_id: user.id },
        select: { project_id: true },
      })
    : []
  const submittedProjectIds = new Set(existingTestimonials.map((t) => t.project_id))
  const testimonialEligible = projects.filter(
    (p) =>
      ['Delivered', 'Complete', 'Archived'].includes(p.phase) &&
      !submittedProjectIds.has(p.id)
  )

  const firstName = user.name.split(' ')[0]

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Welcome */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 900,
            fontSize: 'clamp(24px, 4vw, 36px)',
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}
        >
          Welcome back, {firstName}
        </h1>
        <p style={{ color: 'var(--quiet)', fontSize: '15px' }}>
          Here's an overview of your active projects.
        </p>
      </div>

      {/* Needs Your Review — attention card */}
      {pendingDeliverables.length > 0 && (
        <Card
          style={{
            marginBottom: '24px',
            borderLeft: '3px solid var(--gold)',
            background: 'rgba(242,193,78,0.05)',
            borderColor: 'var(--gold)',
          }}
        >
          <CardHeader style={{ paddingBottom: '12px' }}>
            <CardTitle
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--gold)',
              }}
            >
              Needs Your Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {pendingDeliverables.map((d) => (
                <Link
                  key={d.id}
                  href={`/client/projects/${d.project_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                    textDecoration: 'none',
                    color: 'var(--paper)',
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500, fontSize: '14px' }}>
                    {d.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                    {d.project.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                    {d.deliverable_type}
                  </span>
                  <Badge
                    style={{
                      background: 'rgba(242,193,78,0.15)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(242,193,78,0.3)',
                      fontSize: '11px',
                    }}
                  >
                    Review
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project cards grid */}
      {projects.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--quiet)',
              marginBottom: '12px',
            }}
          >
            Your Projects
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/client/projects/${project.id}`}
                style={{ textDecoration: 'none' }}
              >
                <Card
                  style={{
                    background: 'rgba(247,246,243,0.04)',
                    border: '1px solid rgba(138,138,132,0.2)',
                    transition: 'border-color 0.15s',
                    cursor: 'pointer',
                  }}
                >
                  <CardContent style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '15px',
                          color: 'var(--paper)',
                          display: 'block',
                        }}
                      >
                        {project.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {project.phase && (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {project.phase}
                        </Badge>
                      )}
                      {project.status && (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {project.status}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Invoices */}
      {obligations.length > 0 && (
        <Card
          style={{
            marginBottom: '24px',
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
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {obligations.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        color: 'var(--paper)',
                        fontWeight: 500,
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {inv.description || inv.project?.name || 'Invoice'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                      {formatDate(inv.obligation_date)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--paper)' }}>
                      {formatCurrency(inv.amount)}
                    </span>
                    <Badge
                      variant="outline"
                      style={{
                        fontSize: '10px',
                        color: getStatusColor(inv.status),
                        borderColor: getStatusColor(inv.status),
                        textTransform: 'capitalize',
                      }}
                    >
                      {inv.status || 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Testimonial prompts */}
      {testimonialEligible.length > 0 && (
        <Card
          style={{
            background: 'rgba(58,138,92,0.05)',
            border: '1px solid rgba(58,138,92,0.2)',
            borderLeft: '3px solid var(--green)',
          }}
        >
          <CardHeader style={{ paddingBottom: '12px' }}>
            <CardTitle
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--green)',
              }}
            >
              Share Your Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {testimonialEligible.map((project) => (
                <Link
                  key={project.id}
                  href={`/client/projects/${project.id}/testimonial`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(58,138,92,0.1)',
                    textDecoration: 'none',
                    color: 'var(--paper)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                      We'd love to hear about your experience.
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--green)', flexShrink: 0 }}>
                    Leave a testimonial →
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: 'var(--quiet)',
          }}
        >
          <p style={{ fontSize: '16px' }}>No active projects found.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Contact your producer if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  )
}

function getStatusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'paid' || s === 'complete') return 'var(--green)'
  if (s === 'overdue') return 'var(--red)'
  if (s === 'pending') return 'var(--gold)'
  return 'var(--quiet)'
}
