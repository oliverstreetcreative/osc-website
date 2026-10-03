// Who is looking, and which organization are they looking at?
//
// Clients: access to anything goes through a Membership.
// OSC staff: never see a client's site directly. They pick a client in
// "View as client" (/client/view-as), which sets a signed, short-lived
// cs_view cookie. While it's set the staff member sees exactly that client's
// site, read-only: middleware refuses every non-GET request (lib/client/view-as
// + middleware.ts), and a banner says who they're viewing.
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { jwtVerify } from "jose"
import { getPortalUser, type PortalUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"

export const ORG_COOKIE = "cs_org"
export const VIEW_COOKIE = "cs_view"

export type OrgSummary = { id: string; slug: string; name: string; short_name: string | null; logo_path: string | null }

export type ClientContext = {
  user: PortalUser & { first_name: string | null }
  org: OrgSummary
  orgs: OrgSummary[]
  role: "OWNER" | "APPROVER" | "BILLING" | "VIEWER" | "STAFF"
  /** Set when OSC staff are viewing a client's site (read-only). */
  viewing: { orgName: string; preview: boolean; legacy?: boolean } | null
}

const orgSelect = { id: true, slug: true, name: true, short_name: true, logo_path: true } as const

/** The org a staff member chose in View as client, if the cookie is valid and theirs. */
export async function viewAsOrgSlug(staffId: string): Promise<string | null> {
  const token = (await cookies()).get(VIEW_COOKIE)?.value
  const secret = process.env.SESSION_JWT_SECRET
  if (!token || !secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (payload.purpose !== "view_as" || payload.staff_id !== staffId) return null
    return typeof payload.org === "string" ? payload.org : null
  } catch {
    return null
  }
}

export async function getClientContext(): Promise<ClientContext | null> {
  const user = await getPortalUser()
  if (!user) return null
  const person = await db.person.findUnique({ where: { id: user.id }, select: { first_name: true } })
  const me = { ...user, first_name: person?.first_name ?? null }

  if (user.is_staff) {
    const slug = await viewAsOrgSlug(user.id)
    if (!slug) return null
    const org = await db.organization.findFirst({ where: { slug, hidden: false }, select: orgSelect })
    if (!org) return null
    return {
      user: me,
      org,
      orgs: [org],
      role: "STAFF",
      viewing: { orgName: org.short_name ?? org.name, preview: org.slug.endsWith("--preview") },
    }
  }

  const ms = await db.membership.findMany({
    where: { person_id: user.id, hidden: false, organization: { hidden: false } },
    select: { role: true, organization: { select: orgSelect } },
    orderBy: { organization: { name: "asc" } },
  })
  const orgs = ms.map((m) => m.organization)
  if (!orgs.length) return null
  const roles = new Map(ms.map((m) => [m.organization.id, m.role]))
  const wanted = (await cookies()).get(ORG_COOKIE)?.value
  const org = orgs.find((o) => o.slug === wanted) ?? orgs[0]
  // The older admin impersonation swaps the identity to this client. Inside the
  // client site it is treated exactly like View as client: read-only, with the bar.
  const impersonated = (await headers()).get("x-impersonating") === "true"
  return {
    user: me,
    org,
    orgs,
    role: roles.get(org.id)!,
    viewing: impersonated ? { orgName: org.short_name ?? org.name, preview: false, legacy: true } : null,
  }
}

/** For write handlers: true when this request may change anything (no staff view of any kind). */
export function canWrite(ctx: ClientContext | null): ctx is ClientContext {
  return !!ctx && !ctx.viewing
}

export async function requireClientContext(): Promise<ClientContext> {
  const ctx = await getClientContext()
  if (ctx) return ctx
  const user = await getPortalUser()
  if (user?.is_staff) redirect("/client/view-as")
  redirect(user ? "/login?no_account=1" : "/login")
}
