import { redirect } from 'next/navigation'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'

export const metadata = { title: 'Impersonate User | OSC Admin' }

export default async function ImpersonatePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }
  if (!user.is_staff) redirect('/login')

  const { q, role } = await searchParams

  // Load all portal-allowed, non-staff persons
  const persons = await db.person.findMany({
    where: {
      portal_allowed: true,
      is_staff: false,
      ...(role === 'CLIENT' || role === 'CREW' ? { role: role as 'CLIENT' | 'CREW' } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true },
  })

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-garamond)',
          fontStyle: 'italic',
          fontSize: '28px',
          fontWeight: 400,
          color: 'var(--paper)',
          margin: '0 0 8px 0',
        }}
      >
        Impersonate a User
      </h1>
      <p style={{ color: 'var(--quiet)', fontSize: '14px', margin: '0 0 28px 0' }}>
        View the portal exactly as a client or crew member sees it. All writes are
        blocked while impersonating.
      </p>

      {/* Search/filter form */}
      <form
        method="GET"
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or email…"
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(138,138,132,0.3)',
            borderRadius: '6px',
            color: 'var(--paper)',
            fontSize: '14px',
            fontFamily: 'var(--font-body, Inter, sans-serif)',
          }}
        />
        <select
          name="role"
          defaultValue={role ?? ''}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(138,138,132,0.3)',
            borderRadius: '6px',
            color: 'var(--paper)',
            fontSize: '14px',
            fontFamily: 'var(--font-body, Inter, sans-serif)',
            cursor: 'pointer',
          }}
        >
          <option value="">All roles</option>
          <option value="CLIENT">Client</option>
          <option value="CREW">Crew</option>
        </select>
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(138,138,132,0.3)',
            borderRadius: '6px',
            color: 'var(--paper)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body, Inter, sans-serif)',
          }}
        >
          Search
        </button>
        {(q || role) && (
          <a
            href="/admin/impersonate"
            style={{
              fontSize: '13px',
              color: 'var(--quiet)',
              textDecoration: 'underline',
              padding: '8px 4px',
            }}
          >
            Clear
          </a>
        )}
      </form>

      {persons.length === 0 ? (
        <p style={{ color: 'var(--quiet)', fontSize: '14px' }}>No users found.</p>
      ) : (
        <div
          style={{
            border: '1px solid rgba(138,138,132,0.2)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 120px 180px',
              gap: '0',
              background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(138,138,132,0.2)',
              padding: '10px 20px',
            }}
          >
            {['Name', 'Email', 'Role', ''].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--quiet)',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {persons.map((person, idx) => (
            <ImpersonateRow
              key={person.id}
              person={person}
              isLast={idx === persons.length - 1}
            />
          ))}
        </div>
      )}

      <p style={{ marginTop: '32px', fontSize: '12px', color: 'var(--quiet)' }}>
        All impersonation sessions are logged.{' '}
        <a
          href="/admin/audit/impersonation"
          style={{ color: 'var(--quiet)', textDecoration: 'underline' }}
        >
          View audit log →
        </a>
      </p>
    </div>
  )
}

function ImpersonateRow({
  person,
  isLast,
}: {
  person: { id: string; name: string; email: string; role: string }
  isLast: boolean
}) {
  const roleLabel = person.role === 'CLIENT' ? 'Client' : 'Crew'
  const roleColor = person.role === 'CLIENT' ? '#60a5fa' : '#34d399'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 120px 180px',
        gap: '0',
        padding: '12px 20px',
        alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid rgba(138,138,132,0.1)',
        background: 'transparent',
      }}
    >
      <span style={{ fontSize: '14px', color: 'var(--paper)', fontWeight: 500 }}>
        {person.name}
      </span>
      <span style={{ fontSize: '13px', color: 'var(--quiet)' }}>{person.email}</span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: roleColor,
        }}
      >
        {roleLabel}
      </span>
      <form action="/api/admin/impersonate/start" method="POST">
        <input type="hidden" name="targetPersonId" value={person.id} />
        <button
          type="submit"
          style={{
            padding: '5px 14px',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: '5px',
            color: '#f59e0b',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body, Inter, sans-serif)',
            letterSpacing: '0.03em',
          }}
        >
          Impersonate
        </button>
      </form>
    </div>
  )
}
