import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { SignOutButton } from '@/app/client/components/SignOutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  if (!user.is_staff) {
    redirect('/login')
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#111',
          borderBottom: '1px solid rgba(138,138,132,0.2)',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href="/admin"
            style={{
              fontFamily: 'var(--font-garamond)',
              fontStyle: 'italic',
              fontSize: '18px',
              color: 'var(--paper)',
              textDecoration: 'none',
              fontWeight: 400,
            }}
          >
            Oliver Street Creative
          </Link>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#e05c5c',
              background: 'rgba(224,92,92,0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Admin
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--quiet)' }}>{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          style={{
            width: '200px',
            flexShrink: 0,
            borderRight: '1px solid rgba(138,138,132,0.15)',
            padding: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/projects">Projects</NavLink>
          <NavLink href="/admin/invites">Invites</NavLink>
          <NavLink href="/admin/uploads">Uploads</NavLink>
          <NavLink href="/admin/tasks">Tasks</NavLink>
        </nav>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '32px 40px',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '8px 20px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--quiet)',
        textDecoration: 'none',
        letterSpacing: '0.03em',
      }}
    >
      {children}
    </Link>
  )
}
