import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { ErrorReportTable } from './ErrorReportTable'

export const metadata = { title: 'Error Reports — OSC Admin' }

export default async function AdminErrorReportsPage() {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  if (!user.is_staff) {
    redirect('/login')
  }

  const reports = await db.portalErrorReport.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  })

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Page header */}
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
          Error Reports
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {reports.length} report{reports.length !== 1 ? 's' : ''} total — click any row to
          expand
        </p>
      </div>

      <ErrorReportTable reports={reports} />
    </div>
  )
}
