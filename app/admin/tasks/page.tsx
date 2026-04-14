import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Tasks — OSC Admin' }

export default async function AdminTasksPage() {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const tasks = await db.task.findMany({
    include: {
      project: { select: { id: true, name: true, job_number: true } },
      assignee: { select: { name: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { title: 'asc' }],
  })

  type ProjectGroup = {
    id: string
    name: string
    job_number: string | null
    todo: number
    in_progress: number
    done: number
    other: number
    total: number
  }

  const projectMap = new Map<string, ProjectGroup>()

  for (const task of tasks) {
    const pid = task.project_id
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        id: task.project.id,
        name: task.project.name,
        job_number: task.project.job_number,
        todo: 0,
        in_progress: 0,
        done: 0,
        other: 0,
        total: 0,
      })
    }
    const g = projectMap.get(pid)!
    g.total++
    const s = task.status.toLowerCase().replace(/[\s-]/g, '_')
    if (s === 'todo' || s === 'to_do') g.todo++
    else if (s === 'in_progress') g.in_progress++
    else if (s === 'done' || s === 'complete' || s === 'completed') g.done++
    else g.other++
  }

  const groups = Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ maxWidth: '860px' }}>
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
          Tasks
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} across {groups.length} project
          {groups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {groups.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No tasks found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(138,138,132,0.25)' }}>
              {['Project', 'Job #', 'Todo', 'In Progress', 'Done', 'Other', 'Total'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 12px',
                    textAlign: h === 'Project' || h === 'Job #' ? 'left' : 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--quiet)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.id}
                style={{ borderBottom: '1px solid rgba(138,138,132,0.08)' }}
              >
                <td style={{ padding: '12px 12px' }}>
                  <Link
                    href={`/admin/projects/${g.id}/visibility`}
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--paper)',
                      textDecoration: 'none',
                    }}
                  >
                    {g.name}
                  </Link>
                </td>
                <td
                  style={{
                    padding: '12px 12px',
                    fontSize: '12px',
                    color: 'var(--quiet)',
                    fontFamily: 'monospace',
                  }}
                >
                  {g.job_number || '—'}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {g.todo > 0 ? (
                    <Badge
                      style={{
                        background: 'rgba(242,193,78,0.1)',
                        color: 'var(--gold)',
                        border: '1px solid rgba(242,193,78,0.3)',
                        fontSize: '12px',
                        minWidth: '28px',
                        justifyContent: 'center',
                      }}
                    >
                      {g.todo}
                    </Badge>
                  ) : (
                    <span style={{ color: 'rgba(138,138,132,0.3)', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {g.in_progress > 0 ? (
                    <Badge
                      style={{
                        background: 'rgba(100,160,240,0.1)',
                        color: '#64a0f0',
                        border: '1px solid rgba(100,160,240,0.3)',
                        fontSize: '12px',
                        minWidth: '28px',
                        justifyContent: 'center',
                      }}
                    >
                      {g.in_progress}
                    </Badge>
                  ) : (
                    <span style={{ color: 'rgba(138,138,132,0.3)', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {g.done > 0 ? (
                    <Badge
                      style={{
                        background: 'rgba(58,138,92,0.1)',
                        color: 'var(--green)',
                        border: '1px solid rgba(58,138,92,0.3)',
                        fontSize: '12px',
                        minWidth: '28px',
                        justifyContent: 'center',
                      }}
                    >
                      {g.done}
                    </Badge>
                  ) : (
                    <span style={{ color: 'rgba(138,138,132,0.3)', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {g.other > 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--quiet)' }}>{g.other}</span>
                  ) : (
                    <span style={{ color: 'rgba(138,138,132,0.3)', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--paper)',
                  }}
                >
                  {g.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
