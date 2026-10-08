import { sessionUser } from './auth/require-session'

export type PortalUser = {
  id: string
  name: string
  email: string
  role: string
  is_staff: boolean
  portal_allowed: boolean
}

/**
 * The signed-in person, from the SESSION ROW (lib/auth/require-session.ts, SPEC §27 P0 v2): never from a header.
 * Null with no live session, for a person who isn't portal-allowed, and for a script invite's session (it opens one
 * script, through the Scripts access check only, and is never "the person" anywhere else).
 */
export async function getPortalUser(): Promise<PortalUser | null> {
  const s = await sessionUser()
  if (!s || s.scope) return null
  const p = s.person
  return p.portal_allowed ? { id: p.id, name: p.name, email: p.email, role: p.role, is_staff: p.is_staff, portal_allowed: true } : null
}

/**
 * For staff-only pages and API routes: the signed-in person, only when the DATABASE says they are staff (the token's
 * claim is only the middleware's pre-filter). Pages call this themselves: a layout doesn't re-run on client-side
 * navigation (SPEC §27 P0 v2 review).
 */
export async function getStaffUser(): Promise<PortalUser | null> {
  const user = await getPortalUser()
  return user?.is_staff ? user : null
}

/**
 * Like getPortalUser but throws if not authenticated or not portal-allowed.
 * Use this in page/layout server components that require auth.
 */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
