import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UpdateReplyForm } from './components/UpdateReplyForm'
import FileUploadSection from './components/FileUploadSection'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, select: { name: true } })
  return { title: project ? `${project.name} — OSC Client Portal` : 'Project — OSC Client Portal' }
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params

  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Verify user has access to this project (is a participant)
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
      deliverables: {
        where: { client_visible: true },
        orderBy: { created_at: 'desc' },
      },
      updates: {
        orderBy: { posted_at: 'desc' },
        take: 20,
      },
      obligations: {
        where: { type: 'receivable' },
        orderBy: { obligation_date: 'desc' },
        take: 10,
      },
      _count: { select: { change_orders: true } },
    },
  })

  if (!project) notFound()

  // Check for existing testimonial
  const existingTestimonial = await db.testimonial.findFirst({
    where: { project_id: id, person_id: user.id },
    select: { id: true, quote_text: true },
  })

  const { deliverables, updates, obligations } = project
  const changeOrderCount = project._count.change_orders

  return (
    <div style={{ maxWidth: '860px' }}>
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
        <span style={{ color: 'var(--paper)' }}>{project.name}</span>
      </div>

      {/* Project header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 900,
            fontSize: 'clamp(22px, 3vw, 32px)',
            letterSpacing: '-0.02em',
          }}
        >
          {project.name}
        </h1>
        {project.phase && (
          <Badge
            variant="outline"
            style={{
              fontSize: '11px',
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
              fontSize: '11px',
              color: 'var(--quiet)',
              borderColor: 'rgba(138,138,132,0.3)',
            }}
          >
            {project.status}
          </Badge>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Proposal & Scope */}
        <SectionCard title="Proposal & Scope">
          <p style={{ fontSize: '14px', color: 'var(--quiet)', lineHeight: 1.6 }}>
            View the approved scope, proposal, and any signed change orders for this project.
          </p>
          <div style={{ marginTop: '12px' }}>
            <Link
              href={`/client/projects/${id}/scope`}
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
              View Scope &amp; Proposal →
            </Link>
            {changeOrderCount > 0 && (
              <span
                style={{
                  marginLeft: '12px',
                  fontSize: '12px',
                  color: 'var(--quiet)',
                }}
              >
                {changeOrderCount} change order{changeOrderCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </SectionCard>

        {/* 2. Deliverables */}
        <SectionCard title="Deliverables">
          {deliverables.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>
              No deliverables shared yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {deliverables.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--paper)',
                        marginBottom: '2px',
                      }}
                    >
                      {d.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                      {d.deliverable_type}
                      {d.due_date ? ` · Due ${formatDate(d.due_date)}` : ''}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    style={{
                      fontSize: '11px',
                      flexShrink: 0,
                      color: deliverableStatusColor(d.review_status),
                      borderColor: deliverableStatusColor(d.review_status),
                    }}
                  >
                    {d.review_status || 'Draft'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 3. Project Updates */}
        <SectionCard title="Project Updates">
          {updates.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No updates yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {updates.map((u) => (
                <div
                  key={u.id}
                  style={{
                    paddingBottom: '16px',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--paper)' }}>
                      {u.author}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                      {formatDate(u.posted_at)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.65,
                      color: 'var(--paper)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {u.body}
                  </p>
                  {u.client_reply && (
                    <div
                      style={{
                        marginTop: '8px',
                        paddingLeft: '12px',
                        borderLeft: '2px solid rgba(138,138,132,0.3)',
                      }}
                    >
                      <p style={{ fontSize: '13px', color: 'var(--quiet)', fontStyle: 'italic' }}>
                        {u.client_reply}
                      </p>
                    </div>
                  )}
                  {!u.client_reply && (
                    <UpdateReplyForm updateId={u.id} projectId={id} />
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 4. Files & Assets */}
        <SectionCard title="Files & Assets">
          <p style={{ fontSize: '14px', color: 'var(--quiet)', lineHeight: 1.6 }}>
            Shared files and final assets will appear here. Check back after delivery or contact
            your producer for early access links.
          </p>
          {deliverables
            .filter((d) => d.dropbox_path)
            .map((d) => (
              <a
                key={d.id}
                href={d.dropbox_path!}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block',
                  marginTop: '8px',
                  padding: '8px 12px',
                  border: '1px solid rgba(138,138,132,0.2)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                }}
              >
                {d.name}
              </a>
            ))}
          <FileUploadSection projectId={id} />
        </SectionCard>

        {/* 5. Invoices */}
        <SectionCard title="Invoices">
          {obligations.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No invoices yet.</p>
          ) : (
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
                        fontWeight: 500,
                        color: 'var(--paper)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {inv.description || inv.obligation_number || 'Invoice'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                      {formatDate(inv.obligation_date)}
                      {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
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
                      {formatCurrency(inv.amount)}
                    </span>
                    {inv.invoice_pdf_path && (
                      <a
                        href={inv.invoice_pdf_path}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '11px', color: 'var(--quiet)', textDecoration: 'underline' }}
                      >
                        PDF
                      </a>
                    )}
                    <Badge
                      variant="outline"
                      style={{
                        fontSize: '10px',
                        color: getInvoiceStatusColor(inv.status),
                        borderColor: getInvoiceStatusColor(inv.status),
                        textTransform: 'capitalize',
                      }}
                    >
                      {inv.status || 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 6. Testimonial */}
        <SectionCard title="Testimonial">
          {existingTestimonial ? (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--green)', marginBottom: '8px' }}>
                Thank you! Your testimonial has been received.
              </p>
              <blockquote
                style={{
                  borderLeft: '3px solid var(--green)',
                  paddingLeft: '12px',
                  fontStyle: 'italic',
                  fontSize: '14px',
                  color: 'var(--quiet)',
                  lineHeight: 1.6,
                }}
              >
                "{existingTestimonial.quote_text}"
              </blockquote>
            </div>
          ) : ['Delivered', 'Complete', 'Archived'].includes(project.phase) ? (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--quiet)', marginBottom: '12px', lineHeight: 1.6 }}>
                We'd love to hear about your experience. A testimonial helps us grow and lets
                future clients know what to expect.
              </p>
              <Link
                href={`/client/projects/${id}/testimonial`}
                style={{
                  display: 'inline-block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--green)',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  border: '1px solid rgba(58,138,92,0.4)',
                  borderRadius: '6px',
                }}
              >
                Leave a Testimonial →
              </Link>
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>
              We'll ask for a testimonial once your project is delivered.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
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
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function deliverableStatusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase().replace(/\s+/g, '-')
  if (s === 'approved') return 'var(--green)'
  if (s === 'pending-review' || s === 'in-review') return 'var(--gold)'
  if (s === 'changes-requested') return 'var(--red)'
  return 'var(--quiet)'
}

function getInvoiceStatusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'paid') return 'var(--green)'
  if (s === 'overdue') return 'var(--red)'
  if (s === 'pending') return 'var(--gold)'
  return 'var(--quiet)'
}
