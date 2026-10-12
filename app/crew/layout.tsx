import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalUser } from '@/lib/portal-auth'
import { SignOutButton } from '../client/components/SignOutButton'
import { ActivityFeed } from '@/components/portal/ActivityFeed'
import { SiteFrame } from '@/components/site/SiteFrame'

export default async function CrewPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getPortalUser()
  if (!user) redirect('/login')
  return (
    <SiteFrame bare right={<div className="crew-account"><span title={user.email}>{user.email}</span><SignOutButton /></div>}>
      <div className="crew-shell">
        <nav className="crew-nav" aria-label="Crew">
          <Link href="/crew">Dashboard</Link>
          <Link href="/crew/invoices">Invoices</Link>
          <ActivityFeed />
        </nav>
        <div className="crew-main">{children}</div>
      </div>
    </SiteFrame>
  )
}
