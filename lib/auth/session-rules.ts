// The session's pure rules (SPEC §27 P0 v2), shared by the Edge middleware and the server check, and unit-tested in
// session-rules.test.ts. No imports but a type: the Edge can load it.
import { parseScope, type Scope } from "./paths"

export const IDLE_MS = 30 * 86400_000

export type EdgeSession = {
  id: string
  email: string
  role: string
  is_staff: boolean
  demo?: string
  preview: boolean
  /** A script invite's session: it may reach its own script and nothing else. */
  scope: Scope | null
}

/**
 * The middleware's reading of a VERIFIED token's claims (signature and expiry already checked). No `sid` → no session
 * (every token from before the session rows signs out once). A scoped token is never a person: no staff flag, and it
 * carries no `id` at all.
 */
export function edgeSession(payload: Record<string, unknown> | null): EdgeSession | null {
  if (!payload || typeof payload.sid !== "string" || !payload.sid) return null
  if (payload.purpose === "magic_link") return null
  const scope = parseScope(payload.scope)
  if (scope === "bad") return null
  if (!scope && !payload.id) return null
  return {
    id: scope ? "" : String(payload.id ?? ""),
    email: scope ? "" : String(payload.email ?? ""),
    role: scope ? "" : String(payload.role ?? ""),
    is_staff: !scope && payload.is_staff === true,
    demo: payload.demo === undefined ? undefined : String(payload.demo),
    preview: payload.preview === true,
    scope,
  }
}

export type SessionRow = {
  revoked_at: Date | null
  expires_at: Date
  last_active_at: Date | null
  token_hash: string
  scope: string | null
  person: { portal_allowed: boolean }
}

/** Is this row still a live session for this token at `now`? null = yes; otherwise why not. */
export function rowProblem(row: SessionRow | null, tokenHash: string, scope: Scope | null, now: number): string | null {
  if (!row) return "no such session"
  if (row.revoked_at) return "signed out"
  if (row.expires_at.getTime() <= now) return "expired"
  if (row.token_hash !== tokenHash) return "not this token's session"
  if (row.last_active_at && now - row.last_active_at.getTime() > IDLE_MS) return "idle too long"
  if (!row.person.portal_allowed) return "switched off"
  if ((row.scope ?? null) !== (scope ? `script:${scope.id}` : null)) return "scope mismatch"
  return null
}
