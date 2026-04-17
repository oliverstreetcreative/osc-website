import { headers } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

export const IMPERSONATION_COOKIE = 'osc_impersonating'
const IMPERSONATION_EXPIRY_HOURS = 1

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error('SESSION_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

/**
 * Returns true if the current request is in impersonation mode.
 * Read from the x-impersonating header set by middleware.
 */
export async function isImpersonating(): Promise<boolean> {
  const h = await headers()
  return h.get('x-impersonating') === 'true'
}

/**
 * Returns impersonation state if active, or null.
 */
export async function getImpersonationState(): Promise<{
  targetId: string
  targetName: string | null
  targetRole: string | null
  impersonatorId: string
} | null> {
  const h = await headers()
  if (h.get('x-impersonating') !== 'true') return null
  return {
    targetId: h.get('x-user-id')!,
    targetName: h.get('x-impersonation-target-name'),
    targetRole: h.get('x-user-role'),
    impersonatorId: h.get('x-impersonator-id')!,
  }
}

/**
 * Creates a signed JWT impersonation token.
 */
export async function createImpersonationToken(params: {
  impersonatorPersonId: string
  targetPersonId: string
  targetRole: string
  targetName: string
  targetEmail: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + IMPERSONATION_EXPIRY_HOURS * 3600

  return new SignJWT({
    impersonator_person_id: params.impersonatorPersonId,
    target_person_id: params.targetPersonId,
    target_role: params.targetRole,
    target_name: params.targetName,
    target_email: params.targetEmail,
    started_at: now,
    expires_at: expiresAt,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(getSecret())
}

/**
 * Verifies an impersonation token and returns the payload, or null if invalid/expired.
 */
export async function verifyImpersonationToken(token: string): Promise<{
  impersonator_person_id: string
  target_person_id: string
  target_role: string
  target_name: string
  target_email: string
  started_at: number
  expires_at: number
} | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as {
      impersonator_person_id: string
      target_person_id: string
      target_role: string
      target_name: string
      target_email: string
      started_at: number
      expires_at: number
    }
  } catch {
    return null
  }
}
