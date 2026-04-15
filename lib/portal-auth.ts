import { headers } from 'next/headers'
import { db } from './db'

export type PortalUser = {
  id: string
  name: string
  email: string
  role: string
  is_staff: boolean
  portal_allowed: boolean
}

/**
 * Reads the authenticated user from request headers (set by middleware).
 * Returns null if there is no session or the person is not portal-allowed.
 */
export async function getPortalUser(): Promise<PortalUser | null> {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) return null

  const person = await db.person.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_staff: true,
      portal_allowed: true,
    },
  })

  return person?.portal_allowed ? person : null
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
