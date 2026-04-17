import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Invoices — OSC Crew Portal',
}

function getStatusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'paid' || s === 'complete') return 'var(--green)'
  if (s === 'overdue') return 'var(--red)'
  if (s === 'approved') return 'var(--gold)'
  if (s === 'pending') return 'var(--quiet)'
  return 'var(--quiet)'
}

export default async function CrewInvoicesPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Get projects this person is a participant on
  const participants = await db.projectParticipant.findMany({
    where: { person_id: user.id },
    select: { project_id: true },
  })
  const projectIds = participants.map((p) => p.project_id)

  // Fetch all payable obligations (crew invoices) on those projects
  const obligations = projectIds.length
    ? await db.obligation.findMany({
        where: {
          project_id: { in: projectIds },
          type: 'payable',
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { obligation_date: 'desc' },
      })
    : []

  // Summary stats
  const totalSubmitted = obligations.reduce((sum, o) => sum + Number(o.amount), 0)
  const totalApproved = obligations
    .filter((o) => ['approved', 'paid'].includes((o.status ?? '').toLowerCase()))
    .reduce((sum, o) => sum + Number(o.amount), 0)
  const totalPaid = obligations
    .filter((o) => (o.status ?? '').toLowerCase() === 'paid')
    .reduce((sum, o) => sum + Number(o.amount), 0)

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 900,
            fontSize: 'clamp(22px, 3vw, 30px)',
            letterSpacing: '-0.02em',
          }}
        >
          Invoices
        </h1>
        <Link
          href="/crew/invoices/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'var(--gold)',
            color: '#111',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          + Submit Invoice
        </Link>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {[
          { label: 'Total Submitted', value: totalSubmitted },
          { label: 'Total Approved', value: totalApproved },
          { label: 'Total Paid', value: totalPaid },
        ].map(({ label, value }) => (
          <Card
            key={label}
            style={{
              background: 'rgba(247,246,243,0.04)',
              border: '1px solid rgba(138,138,132,0.2)',
            }}
          >
            <CardContent style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--quiet)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--paper)' }}>
                {formatCurrency(value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoice list */}
      {obligations.length > 0 ? (
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
              All Invoices
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
                    padding: '12px 0',
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
                      {inv.project?.name} &middot; {formatDate(inv.obligation_date)}
                      {inv.paid_date && (
                        <span> &middot; Paid {formatDate(inv.paid_date)}</span>
                      )}
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
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: 'var(--quiet)',
          }}
        >
          <p style={{ fontSize: '16px' }}>No invoices submitted yet.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            <Link href="/crew/invoices/new" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              Submit your first invoice →
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
