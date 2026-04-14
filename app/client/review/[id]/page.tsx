import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate, formatTimecode } from '@/lib/portal-utils'
import { Badge } from '@/components/ui/badge'
import { ReviewForm } from './ReviewForm'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const deliverable = await db.deliverable.findUnique({
    where: { id },
    select: { name: true },
  })
  return {
    title: deliverable
      ? `${deliverable.name} — Review — OSC Client Portal`
      : 'Review — OSC Client Portal',
  }
}

export default async function DeliverableReviewPage({ params }: Props) {
  const { id } = await params

  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Load deliverable with project
  const deliverable = await db.deliverable.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
    },
  })

  if (!deliverable || !deliverable.client_visible) notFound()

  // Verify user is a participant on the deliverable's project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: user.id,
      project_id: deliverable.project_id,
      project: { client_portal_enabled: true },
    },
  })

  if (!participant) notFound()

  // Load approval/review records for this deliverable ordered by decided_at
  const approvals = await db.deliverableApproval.findMany({
    where: { deliverable_id: id },
    include: {
      approver: { select: { name: true } },
    },
    orderBy: { decided_at: 'asc' },
  })

  const reviewStatusColor = (status: string | null | undefined) => {
    const s = (status ?? '').toLowerCase().replace(/\s+/g, '-')
    if (s === 'approved') return 'var(--green)'
    if (s === 'pending-review' || s === 'in-review') return 'var(--gold)'
    if (s === 'changes-requested') return 'var(--red)'
    return 'var(--quiet)'
  }

  const hasDropboxReplay = !!deliverable.dropbox_replay_url

  return (
    <div style={{ maxWidth: '1100px' }}>
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
          href={`/client/projects/${deliverable.project_id}`}
          style={{ color: 'var(--quiet)', textDecoration: 'none' }}
        >
          {deliverable.project.name}
        </Link>
        <span style={{ color: 'var(--faint)' }}>/</span>
        <span style={{ color: 'var(--paper)' }}>{deliverable.name}</span>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          alignItems: 'flex-start',
        }}
      >
        {/* ── Left column: 60% ── */}
        <div style={{ flex: '0 0 60%', minWidth: 0 }}>
          {/* Video area */}
          <div
            style={{
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(138,138,132,0.15)',
              marginBottom: '20px',
              aspectRatio: '16 / 9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hasDropboxReplay ? (
              <iframe
                src={deliverable.dropbox_replay_url!}
                title={deliverable.name}
                allowFullScreen
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: 'var(--quiet)',
                  fontSize: '15px',
                }}
              >
                Video not yet available
              </div>
            )}
          </div>

          {/* Deliverable meta */}
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 900,
                fontSize: 'clamp(20px, 2.5vw, 28px)',
                letterSpacing: '-0.02em',
                marginBottom: '10px',
              }}
            >
              {deliverable.name}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '12px',
              }}
            >
              {deliverable.deliverable_type && (
                <Badge
                  variant="outline"
                  style={{
                    fontSize: '11px',
                    color: 'var(--quiet)',
                    borderColor: 'rgba(138,138,132,0.3)',
                    textTransform: 'capitalize',
                  }}
                >
                  {deliverable.deliverable_type}
                </Badge>
              )}
              {deliverable.review_status && (
                <Badge
                  variant="outline"
                  style={{
                    fontSize: '11px',
                    color: reviewStatusColor(deliverable.review_status),
                    borderColor: reviewStatusColor(deliverable.review_status),
                  }}
                >
                  {deliverable.review_status}
                </Badge>
              )}
              {deliverable.current_version && (
                <span style={{ fontSize: '12px', color: 'var(--faint)' }}>
                  v{deliverable.current_version}
                </span>
              )}
            </div>
            {deliverable.description && (
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--quiet)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {deliverable.description}
              </p>
            )}
          </div>
        </div>

        {/* ── Right column: 40% sticky ── */}
        <div
          style={{
            flex: '0 0 40%',
            minWidth: 0,
            position: 'sticky',
            top: '72px',
            maxHeight: 'calc(100dvh - 96px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
          }}
        >
          <div
            style={{
              background: 'rgba(247,246,243,0.04)',
              border: '1px solid rgba(138,138,132,0.2)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h2
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--quiet)',
                marginBottom: '16px',
              }}
            >
              Review Notes
            </h2>

            {/* Existing review records */}
            {approvals.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                  marginBottom: '20px',
                }}
              >
                {approvals.map((approval) => (
                  <div
                    key={approval.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(138,138,132,0.1)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--paper)' }}
                      >
                        {approval.approver.name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--faint)' }}>
                        {formatDate(approval.decided_at)}
                      </span>
                      {approval.approved !== null && (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: approval.approved ? 'var(--green)' : 'var(--gold)',
                            borderColor: approval.approved
                              ? 'rgba(58,138,92,0.4)'
                              : 'rgba(242,193,78,0.4)',
                          }}
                        >
                          {approval.approved ? 'Approved' : 'Changes Requested'}
                        </Badge>
                      )}
                    </div>
                    {approval.notes && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--paper)',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {approval.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--faint)',
                  marginBottom: '20px',
                  fontStyle: 'italic',
                }}
              >
                No review notes yet. Be the first to leave feedback.
              </p>
            )}

            {/* Divider before form */}
            <div
              style={{
                borderTop: '1px solid rgba(138,138,132,0.15)',
                paddingTop: '20px',
              }}
            >
              <ReviewForm deliverableId={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
