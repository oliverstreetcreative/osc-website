import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, select: { name: true } })
  return {
    title: project
      ? `Scope — ${project.name} — OSC Client Portal`
      : 'Scope — OSC Client Portal',
  }
}

export default async function ProjectScopePage({ params }: Props) {
  const { id } = await params

  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Verify access
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: user.id,
      project_id: id,
      project: { client_portal_enabled: true },
    },
  })

  if (!participant) notFound()

  const project = await db.project.findUnique({
    where: { id },
    include: {
      change_orders: {
        orderBy: { proposed_at: 'desc' },
      },
    },
  })

  if (!project) notFound()

  const { change_orders } = project

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '24px',
          fontSize: '13px',
          color: 'var(--quiet)',
        }}
      >
        <Link href="/client" style={{ color: 'var(--quiet)', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span style={{ color: 'var(--faint)' }}>/</span>
        <Link
          href={`/client/projects/${id}`}
          style={{ color: 'var(--quiet)', textDecoration: 'none' }}
        >
          {project.name}
        </Link>
        <span style={{ color: 'var(--faint)' }}>/</span>
        <span style={{ color: 'var(--paper)' }}>Scope &amp; Proposal</span>
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-inter)',
          fontWeight: 900,
          fontSize: 'clamp(22px, 3vw, 32px)',
          letterSpacing: '-0.02em',
          marginBottom: '32px',
        }}
      >
        Scope &amp; Proposal
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Project Overview */}
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
              Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                  Project
                </span>
                <span style={{ fontSize: '14px', color: 'var(--paper)', fontWeight: 500 }}>
                  {project.name}
                </span>
              </div>
              {project.phase && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                    Phase
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--paper)' }}>{project.phase}</span>
                </div>
              )}
              {project.project_type && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                    Type
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--paper)' }}>
                    {project.project_type}
                  </span>
                </div>
              )}
              {project.shoot_start_date && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                    Shoot Date
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--paper)' }}>
                    {formatDate(project.shoot_start_date)}
                    {project.shoot_end_date &&
                      project.shoot_end_date.getTime() !== project.shoot_start_date.getTime()
                      ? ` – ${formatDate(project.shoot_end_date)}`
                      : ''}
                  </span>
                </div>
              )}
              {project.delivery_date && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                    Delivery
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--paper)' }}>
                    {formatDate(project.delivery_date)}
                  </span>
                </div>
              )}
              {project.job_number && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--quiet)', width: '120px', flexShrink: 0 }}>
                    Job #
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--paper)', fontFamily: 'monospace' }}>
                    {project.job_number}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proposal documents */}
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
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--quiet)',
                lineHeight: 1.6,
                marginBottom: '12px',
              }}
            >
              For the signed proposal packet, contact your producer. Approved scope documents and
              change orders are listed below.
            </p>
            {project.dropbox_path ? (
              <a
                href={project.dropbox_path}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--orange)',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  border: '1px solid rgba(224,120,48,0.4)',
                  borderRadius: '6px',
                }}
              >
                Open Project Folder →
              </a>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--faint)' }}>
                No document links available yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Change Orders */}
        {change_orders.length > 0 && (
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
                Change Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {change_orders.map((co) => (
                  <div
                    key={co.id}
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
                          fontWeight: 500,
                          color: 'var(--paper)',
                          marginBottom: '2px',
                        }}
                      >
                        {co.description}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                        Proposed {formatDate(co.proposed_at)}
                        {co.approved_at ? ` · Approved ${formatDate(co.approved_at)}` : ''}
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
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--paper)' }}>
                        {formatCurrency(co.cost_impact)}
                      </span>
                      <Badge
                        variant="outline"
                        style={{
                          fontSize: '10px',
                          color: changeOrderStatusColor(co.status),
                          borderColor: changeOrderStatusColor(co.status),
                          textTransform: 'capitalize',
                        }}
                      >
                        {co.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function changeOrderStatusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'approved') return 'var(--green)'
  if (s === 'proposed') return 'var(--gold)'
  if (s === 'rejected') return 'var(--red)'
  return 'var(--quiet)'
}
