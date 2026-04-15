import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Badge } from '@/components/ui/badge'
import { InviteActions } from './InviteActions'

export const metadata = { title: 'Invites — OSC Admin' }

export default async function AdminInvitesPage() {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const now = new Date()

  const invites = await db.portalInvite.findMany({
    include: { person: { select: { id: true, name: true, email: true } } },
    orderBy: { created_at: 'desc' },
  })

  function getStatus(invite: (typeof invites)[0]): 'Accepted' | 'Expired' | 'Pending' {
    if (invite.accepted_at) return 'Accepted'
    if (invite.expires_at < now) return 'Expired'
    return 'Pending'
  }

  const statusStyle: Record<string, { color: string; background: string; border: string }> = {
    Accepted: {
      color: 'var(--green)',
      background: 'rgba(58,138,92,0.1)',
      border: '1px solid rgba(58,138,92,0.3)',
    },
    Expired: {
      color: '#e05c5c',
      background: 'rgba(224,92,92,0.1)',
      border: '1px solid rgba(224,92,92,0.3)',
    },
    Pending: {
      color: 'var(--gold)',
      background: 'rgba(242,193,78,0.1)',
      border: '1px solid rgba(242,193,78,0.3)',
    },
  }

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
          Invites
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {invites.length} total invite{invites.length !== 1 ? 's' : ''}
        </p>
      </div>

      {invites.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No invites found.</p>
      ) : (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 90px 110px 110px 110px 120px',
              gap: '8px',
              padding: '8px 12px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--quiet)',
              borderBottom: '1px solid rgba(138,138,132,0.2)',
            }}
          >
            <span>Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Created</span>
            <span>Expires</span>
            <span>Accepted</span>
            <span></span>
          </div>

          {invites.map((invite) => {
            const status = getStatus(invite)
            const ss = statusStyle[status]
            return (
              <div
                key={invite.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 90px 110px 110px 110px 120px',
                  gap: '8px',
                  padding: '12px',
                  borderBottom: '1px solid rgba(138,138,132,0.1)',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--paper)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {invite.person.name}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--quiet)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {invite.person.email}
                </span>
                <span>
                  <Badge
                    style={{
                      fontSize: '10px',
                      ...ss,
                    }}
                  >
                    {status}
                  </Badge>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  {formatDate(invite.created_at)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  {formatDate(invite.expires_at)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  {invite.accepted_at ? formatDate(invite.accepted_at) : '—'}
                </span>
                <InviteActions inviteId={invite.id} status={status} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
