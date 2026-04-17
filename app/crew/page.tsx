import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Dashboard — OSC Crew Portal',
}

export default async function CrewDashboardPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch projects this crew member is a participant on with crew_visible=true
  const participants = await db.projectParticipant.findMany({
    where: {
      person_id: user.id,
      project: { crew_visible: true },
    },
    include: {
      project: true,
    },
    orderBy: { project: { updated_at: 'desc' } },
  })

  const projectIds = participants.map((p) => p.project_id)

  // Upcoming shoots: crew_visible=true, start_date >= today, user has participant on that project
  const upcomingShoots = projectIds.length
    ? await db.shootPeriod.findMany({
        where: {
          project_id: { in: projectIds },
          crew_visible: true,
          start_date: { gte: today },
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { start_date: 'asc' },
        take: 10,
      })
    : []

  // Upcoming trips: for this person, crew_visible=true, departure_date >= today
  const upcomingTrips = await db.trip.findMany({
    where: {
      person_id: user.id,
      crew_visible: true,
      departure_date: { gte: today },
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { departure_date: 'asc' },
    take: 10,
  })

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
          Here's your crew dashboard.
        </p>
      </div>

      {/* Quick Actions */}
      <section style={{ marginBottom: '32px' }}>
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
          Quick Actions
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          <Link href="/crew/invoices/new" style={{ textDecoration: 'none' }}>
            <Card
              style={{
                background: 'rgba(247,246,243,0.04)',
                border: '1px solid rgba(138,138,132,0.2)',
                cursor: 'pointer',
              }}
            >
              <CardContent style={{ padding: '20px' }}>
                <div
                  style={{
                    fontSize: '22px',
                    marginBottom: '8px',
                  }}
                >
                  +
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--paper)', marginBottom: '4px' }}>
                  Submit Invoice
                </div>
                <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  Submit a new invoice for work completed
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/crew/invoices" style={{ textDecoration: 'none' }}>
            <Card
              style={{
                background: 'rgba(247,246,243,0.04)',
                border: '1px solid rgba(138,138,132,0.2)',
                cursor: 'pointer',
              }}
            >
              <CardContent style={{ padding: '20px' }}>
                <div
                  style={{
                    fontSize: '22px',
                    marginBottom: '8px',
                  }}
                >
                  ≡
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--paper)', marginBottom: '4px' }}>
                  Invoice History
                </div>
                <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                  View all submitted invoices
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Your Projects */}
      {participants.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
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
            {participants.map((p) => (
              <Link
                key={p.id}
                href={`/crew/projects/${p.project_id}`}
                style={{ textDecoration: 'none' }}
              >
                <Card
                  style={{
                    background: 'rgba(247,246,243,0.04)',
                    border: '1px solid rgba(138,138,132,0.2)',
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
                          marginBottom: '4px',
                        }}
                      >
                        {p.project.name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                        {p.role}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {p.project.phase && (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {p.project.phase}
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

      {/* Upcoming Shoots */}
      {upcomingShoots.length > 0 && (
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
              Upcoming Shoots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcomingShoots.map((shoot) => (
                <div
                  key={shoot.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
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
                        {shoot.description || shoot.project.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                        {shoot.project.name} &middot;{' '}
                        {formatDate(shoot.start_date)} – {formatDate(shoot.end_date)}
                        {shoot.call_time && (
                          <span> &middot; Call: {shoot.call_time}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Travel */}
      {upcomingTrips.length > 0 && (
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
              Your Travel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcomingTrips.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--paper)', marginBottom: '2px' }}>
                    {trip.purpose || 'Travel'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                    {formatDate(trip.departure_date)} – {formatDate(trip.return_date)}
                    {trip.project && (
                      <span> &middot; {trip.project.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {participants.length === 0 && (
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
