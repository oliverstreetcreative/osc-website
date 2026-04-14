import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/portal-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Uploads — OSC Admin' }

function formatBytes(bytes: bigint | null | undefined): string {
  if (!bytes) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default async function AdminUploadsPage() {
  try {
    await requirePortalUser()
  } catch {
    redirect('/login')
  }

  const uploads = await db.portalUpload.findMany({
    orderBy: { uploaded_at: 'desc' },
    include: {
      uploader: { select: { name: true, email: true } },
      project: { select: { name: true } },
    },
  })

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
          Uploads
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--quiet)' }}>
          {uploads.length} file{uploads.length !== 1 ? 's' : ''} uploaded
        </p>
      </div>

      {uploads.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>No uploads yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {uploads.map((u) => (
            <Card
              key={u.id}
              style={{
                background: 'rgba(247,246,243,0.04)',
                border: '1px solid rgba(138,138,132,0.2)',
              }}
            >
              <CardContent style={{ padding: '16px 20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--paper)',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {u.file_name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--quiet)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{u.project?.name ?? 'No project'}</span>
                      <span>·</span>
                      <span>{u.uploader?.name || u.uploader?.email || 'Unknown'}</span>
                      <span>·</span>
                      <span>{formatDate(u.uploaded_at)}</span>
                      <span>·</span>
                      <span>{formatBytes(u.file_size_bytes)}</span>
                    </div>
                  </div>
                  {u.mime_type && (
                    <Badge
                      variant="outline"
                      style={{
                        fontSize: '10px',
                        color: 'var(--quiet)',
                        borderColor: 'rgba(138,138,132,0.3)',
                        flexShrink: 0,
                        fontFamily: 'monospace',
                      }}
                    >
                      {u.mime_type}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
