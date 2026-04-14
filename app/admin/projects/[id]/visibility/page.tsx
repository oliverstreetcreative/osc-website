import { redirect, notFound } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Badge } from '@/components/ui/badge'
import { VisibilityToggle } from './VisibilityToggle'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, select: { name: true } })
  return { title: `${project?.name ?? 'Project'} — Visibility — OSC Admin` }
}

export default async function VisibilityPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const { id } = await params

  const project = await db.project.findUnique({ where: { id } })
  if (!project) notFound()

  const [deliverables, projectUpdates, changeOrders, obligations, shootPeriods, tasks] =
    await Promise.all([
      db.deliverable.findMany({ where: { project_id: id }, orderBy: { published_at: 'desc' } }),
      db.projectUpdate.findMany({ where: { project_id: id }, orderBy: { posted_at: 'desc' } }),
      db.changeOrder.findMany({ where: { project_id: id }, orderBy: { proposed_at: 'desc' } }),
      db.obligation.findMany({ where: { project_id: id }, orderBy: { obligation_date: 'desc' } }),
      db.shootPeriod.findMany({ where: { project_id: id }, orderBy: { start_date: 'asc' } }),
      db.task.findMany({ where: { project_id: id }, orderBy: { title: 'asc' } }),
    ])

  type Row = {
    id: string
    label: string
    type: string
    table: string
    client_visible: boolean
    crew_visible: boolean | null
    published_at: Date | null
  }

  const rows: Row[] = [
    ...deliverables.map((d) => ({
      id: d.id,
      label: d.name,
      type: d.deliverable_type,
      table: 'deliverables',
      client_visible: d.client_visible,
      crew_visible: null,
      published_at: d.published_at,
    })),
    ...projectUpdates.map((u) => ({
      id: u.id,
      label: u.body.slice(0, 80) + (u.body.length > 80 ? '…' : ''),
      type: 'Update',
      table: 'project_updates',
      client_visible: u.client_visible,
      crew_visible: null,
      published_at: u.published_at,
    })),
    ...changeOrders.map((c) => ({
      id: c.id,
      label: c.description.slice(0, 80) + (c.description.length > 80 ? '…' : ''),
      type: 'Change Order',
      table: 'change_orders',
      client_visible: c.client_visible,
      crew_visible: null,
      published_at: c.published_at,
    })),
    ...obligations.map((o) => ({
      id: o.id,
      label: o.description || `${o.type} · ${String(o.amount)}`,
      type: 'Obligation',
      table: 'obligations',
      client_visible: o.client_visible,
      crew_visible: null,
      published_at: o.published_at,
    })),
    ...shootPeriods.map((s) => ({
      id: s.id,
      label: s.description || `${formatDate(s.start_date)} – ${formatDate(s.end_date)}`,
      type: s.period_type ?? 'Shoot',
      table: 'shoot_periods',
      client_visible: s.client_visible,
      crew_visible: s.crew_visible,
      published_at: s.published_at,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      label: t.title,
      type: 'Task',
      table: 'tasks',
      client_visible: t.client_visible,
      crew_visible: t.crew_visible,
      published_at: t.published_at,
    })),
  ]

  const typeOrder = ['video', 'photo', 'audio', 'other', 'Update', 'Change Order', 'Obligation', 'Shoot', 'Task']

  const grouped = typeOrder
    .map((type) => ({
      type,
      rows: rows.filter((r) => r.type.toLowerCase() === type.toLowerCase()),
    }))
    .filter((g) => g.rows.length > 0)

  const ungrouped = rows.filter(
    (r) => !typeOrder.map((t) => t.toLowerCase()).includes(r.type.toLowerCase())
  )
  if (ungrouped.length > 0) grouped.push({ type: 'Other', rows: ungrouped })

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: 'var(--quiet)', marginBottom: '4px' }}>
          {project.job_number} · {project.phase}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-garamond)',
            fontStyle: 'italic',
            fontSize: '28px',
            fontWeight: 400,
            marginBottom: '4px',
          }}
        >
          {project.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          Publication visibility grid
        </p>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No entities on this project yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(138,138,132,0.25)',
                }}
              >
                {['Name / Description', 'Type', 'Client', 'Crew', 'Published'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: h === 'Client' || h === 'Crew' ? 'center' : 'left',
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
              {grouped.map((group) => (
                <>
                  <tr key={`group-${group.type}`}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '16px 12px 6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--quiet)',
                        borderBottom: '1px solid rgba(138,138,132,0.1)',
                      }}
                    >
                      {group.type}s ({group.rows.length})
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 12px',
                          color: 'var(--paper)',
                          maxWidth: '360px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.label}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '10px',
                            color: 'var(--quiet)',
                            borderColor: 'rgba(138,138,132,0.3)',
                          }}
                        >
                          {row.type}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <VisibilityToggle
                          table={row.table}
                          rowId={row.id}
                          field="client_visible"
                          initialValue={row.client_visible}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {row.crew_visible !== null ? (
                          <VisibilityToggle
                            table={row.table}
                            rowId={row.id}
                            field="crew_visible"
                            initialValue={row.crew_visible}
                          />
                        ) : (
                          <span style={{ color: 'rgba(138,138,132,0.3)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: 'var(--quiet)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(row.published_at)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
