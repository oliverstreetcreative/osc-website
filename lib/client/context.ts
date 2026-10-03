// Who is looking, and which organization are they looking at?
// Access to anything client-side goes through a Membership. Staff see every
// organization (with a switcher) so Sam can look at any client's site.
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getPortalUser, type PortalUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"

export const ORG_COOKIE = "cs_org"

export type OrgSummary = { id: string; slug: string; name: string; short_name: string | null; logo_path: string | null }

export type ClientContext = {
  user: PortalUser & { first_name: string | null }
  org: OrgSummary
  orgs: OrgSummary[]
  role: "OWNER" | "APPROVER" | "BILLING" | "VIEWER" | "STAFF"
}

const orgSelect = { id: true, slug: true, name: true, short_name: true, logo_path: true } as const

export async function getClientContext(): Promise<ClientContext | null> {
  const user = await getPortalUser()
  if (!user) return null
  const person = await db.person.findUnique({ where: { id: user.id }, select: { first_name: true } })

  let orgs: OrgSummary[]
  let roles = new Map<string, ClientContext["role"]>()
  if (user.is_staff) {
    orgs = await db.organization.findMany({ where: { hidden: false }, select: orgSelect, orderBy: { name: "asc" } })
    orgs.forEach((o) => roles.set(o.id, "STAFF"))
  } else {
    const ms = await db.membership.findMany({
      where: { person_id: user.id, hidden: false, organization: { hidden: false } },
      select: { role: true, organization: { select: orgSelect } },
      orderBy: { organization: { name: "asc" } },
    })
    orgs = ms.map((m) => m.organization)
    ms.forEach((m) => roles.set(m.organization.id, m.role))
  }
  if (!orgs.length) return null

  const wanted = (await cookies()).get(ORG_COOKIE)?.value
  const org = orgs.find((o) => o.slug === wanted) ?? orgs[0]
  return { user: { ...user, first_name: person?.first_name ?? null }, org, orgs, role: roles.get(org.id)! }
}

export async function requireClientContext(): Promise<ClientContext> {
  const ctx = await getClientContext()
  if (!ctx) redirect((await getPortalUser()) ? "/login?no_account=1" : "/login")
  return ctx
}
