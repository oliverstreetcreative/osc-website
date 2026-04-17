import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Project — OSC Crew Portal',
}

export default async function CrewProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const { id } = await params

  // Verify project access
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: user.id,
      project_id: id,
    },
  })
  if (!participant) {
    notFound()
  }

  const project = await db.project.findUnique({
    where: { id, crew_visible: true },
  })
  if (!project) {
    notFound()
  }

  // Shoot periods
  const shootPeriods = await db.shootPeriod.findMany({
    where: { project_id: id, crew_visible: true },
    orderBy: { start_date: 'asc' },
  })

  // Tasks assigned to this person on this project
  const tasks = await db.task.findMany({
    where: {
      project_id: id,
      assignee_person_id: user.id,
      crew_visible: true,
    },
    orderBy: [{ phase: 'asc' }, { title: 'asc' }],
  })

  // Group tasks by phase
  const tasksByPhase: Record<string, typeof tasks> = {}
  for (const task of tasks) {
    const phase = task.phase ?? 'Other'
    if (!tasksByPhase[phase]) tasksByPhase[phase] = []
    tasksByPhase[phase].push(task)
  }

  // Travel for this person on this project
  const trips = await db.trip.findMany({
    where: {
      person_id: user.id,
      project_id: id,
      crew_visible: true,
    },
    orderBy: { departure_date: 'asc' },
  })

  const phaseColors: Record<string, string> = {
    'pre-prod': 'var(--gold)',
    'shoot': 'var(--green)',
    'post': '#7c9ef5',
    'delivery': 'var(--quiet)',
  }

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Back link */}
      <Link
        href="/crew"
        style={{
          fontSize: '13px',
          color: 'var(--quiet)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: '20px',
        }}
      >
        ← Dashboard
      </Link>

      {/* Project header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 900,
              fontSize: 'clamp(22px, 3vw, 30px)',
              letterSpacing: '-0.02em',
              margin: 0,
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
                alignSelf: 'center',
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
                alignSelf: 'center',
              }}
            >
              {project.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Your Role */}
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
            Your Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--paper)' }}>
            {participant.role}
          </div>
          <Link
            href={`/crew/projects/${id}/tasks`}
            style={{
              display: 'inline-block',
              marginTop: '12px',
              fontSize: '13px',
              color: 'var(--gold)',
              textDecoration: 'none',
            }}
          >
            View your tasks →
          </Link>
        </CardContent>
      </Card>

      {/* Shoot Schedule */}
      {shootPeriods.length > 0 && (
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
              Shoot Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {shootPeriods.map((shoot) => (
                <div
                  key={shoot.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(138,138,132,0.1)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--paper)', marginBottom: '2px' }}>
                    {shoot.description || 'Shoot Day'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--quiet)' }}>
                    {formatDate(shoot.start_date)} – {formatDate(shoot.end_date)}
                    {shoot.call_time && (
                      <span> &middot; Call: {shoot.call_time}</span>
                    )}
                    {shoot.period_type && (
                      <span> &middot; {shoot.period_type}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Tasks */}
      {tasks.length > 0 && (
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
              Your Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
              <div key={phase} style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: phaseColors[phase.toLowerCase()] ?? 'var(--quiet)',
                    marginBottom: '8px',
                  }}
                >
                  {phase}
                </div>
                {phaseTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(138,138,132,0.08)',
                      opacity: task.status === 'done' ? 0.5 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '14px',
                          color: 'var(--paper)',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </span>
                    </div>
                    {task.priority && (
                      <Badge
                        variant="outline"
                        style={{
                          fontSize: '10px',
                          color: 'var(--quiet)',
                          borderColor: 'rgba(138,138,132,0.3)',
                          flexShrink: 0,
                        }}
                      >
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <Link
              href={`/crew/projects/${id}/tasks`}
              style={{
                display: 'inline-block',
                marginTop: '8px',
                fontSize: '13px',
                color: 'var(--gold)',
                textDecoration: 'none',
              }}
            >
              View all tasks →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Travel */}
      {trips.length > 0 && (
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
              Travel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {trips.map((trip) => (
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
