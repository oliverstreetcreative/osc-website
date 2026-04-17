import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskCheckbox } from './TaskCheckbox'

export const metadata = {
  title: 'Tasks — OSC Crew Portal',
}

const PHASE_ORDER = ['pre-prod', 'shoot', 'post', 'delivery']

function getPriorityColor(priority: string | null | undefined): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'urgent' || p === 'high') return 'var(--red)'
  if (p === 'medium') return 'var(--gold)'
  return 'var(--quiet)'
}

export default async function CrewProjectTasksPage({
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

  // Verify access
  const participant = await db.projectParticipant.findFirst({
    where: { person_id: user.id, project_id: id },
  })
  if (!participant) {
    notFound()
  }

  const project = await db.project.findUnique({
    where: { id, crew_visible: true },
    select: { id: true, name: true },
  })
  if (!project) {
    notFound()
  }

  // All tasks assigned to this person on this project
  const tasks = await db.task.findMany({
    where: {
      project_id: id,
      assignee_person_id: user.id,
      crew_visible: true,
    },
    orderBy: [{ phase: 'asc' }, { title: 'asc' }],
  })

  // Separate done tasks
  const activeTasks = tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasks.filter((t) => t.status === 'done')

  // Group active tasks by phase
  const tasksByPhase: Record<string, typeof tasks> = {}
  for (const task of activeTasks) {
    const phase = task.phase ?? 'other'
    if (!tasksByPhase[phase]) tasksByPhase[phase] = []
    tasksByPhase[phase].push(task)
  }

  // Sort phases
  const sortedPhases = Object.keys(tasksByPhase).sort((a, b) => {
    const ai = PHASE_ORDER.indexOf(a.toLowerCase())
    const bi = PHASE_ORDER.indexOf(b.toLowerCase())
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const phaseColors: Record<string, string> = {
    'pre-prod': 'var(--gold)',
    'shoot': 'var(--green)',
    'post': '#7c9ef5',
    'delivery': 'var(--quiet)',
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Back link */}
      <Link
        href={`/crew/projects/${id}`}
        style={{
          fontSize: '13px',
          color: 'var(--quiet)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: '20px',
        }}
      >
        ← {project.name}
      </Link>

      <h1
        style={{
          fontFamily: 'var(--font-inter)',
          fontWeight: 900,
          fontSize: 'clamp(22px, 3vw, 30px)',
          letterSpacing: '-0.02em',
          marginBottom: '28px',
        }}
      >
        Your Tasks
      </h1>

      {tasks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: 'var(--quiet)',
          }}
        >
          <p style={{ fontSize: '16px' }}>No tasks assigned to you on this project.</p>
        </div>
      ) : (
        <>
          {/* Active tasks by phase */}
          {sortedPhases.map((phase) => (
            <Card
              key={phase}
              style={{
                marginBottom: '20px',
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
                    color: phaseColors[phase.toLowerCase()] ?? 'var(--quiet)',
                  }}
                >
                  {phase}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {tasksByPhase[phase].map((task) => {
                    const isBlocked = task.blocked_by != null && (
                      Array.isArray(task.blocked_by)
                        ? (task.blocked_by as unknown[]).length > 0
                        : Object.keys(task.blocked_by as object).length > 0
                    )
                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(138,138,132,0.08)',
                          opacity: isBlocked ? 0.5 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                          }}
                        >
                          <div style={{ paddingTop: '2px', flexShrink: 0 }}>
                            <TaskCheckbox
                              taskId={task.id}
                              projectId={id}
                              initialChecked={task.status === 'done'}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '14px',
                                  color: isBlocked ? 'var(--quiet)' : 'var(--paper)',
                                  fontWeight: 500,
                                }}
                              >
                                {task.title}
                              </span>
                              {task.priority && (
                                <Badge
                                  variant="outline"
                                  style={{
                                    fontSize: '10px',
                                    color: getPriorityColor(task.priority),
                                    borderColor: getPriorityColor(task.priority),
                                  }}
                                >
                                  {task.priority}
                                </Badge>
                              )}
                              {isBlocked && (
                                <Badge
                                  variant="outline"
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--quiet)',
                                    borderColor: 'rgba(138,138,132,0.3)',
                                  }}
                                >
                                  Blocked
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <Card
              style={{
                marginBottom: '20px',
                background: 'rgba(247,246,243,0.02)',
                border: '1px solid rgba(138,138,132,0.12)',
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
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {doneTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(138,138,132,0.06)',
                        opacity: 0.45,
                      }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        <TaskCheckbox
                          taskId={task.id}
                          projectId={id}
                          initialChecked={true}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '14px',
                          color: 'var(--quiet)',
                          textDecoration: 'line-through',
                        }}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
