// THE server-side session check (SPEC §27 P0 v2). Every page and handler reaches the signed-in person through here
// (lib/portal-auth.ts getPortalUser, the Scripts access check, the sign-out routes). It verifies the cookie itself (no
// header is trusted), then ONE query joins the row and the person, once per request:
//   no row, revoked, past its absolute end, idle more than 30 days, a token that isn't the row's, or a person switched
//   off → null. The Edge middleware only pre-filters on the JWT's signature and claims.
import { cache } from "react"
import { cookies, headers } from "next/headers"
import { createHash } from "crypto"
import { jwtVerify } from "jose"
import { db } from "@/lib/db"
import { parseScope, type Scope } from "./paths"
import { rowProblem } from "./session-rules"
import { SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE, type SessionKind } from "./session"

export { IDLE_MS } from "./session-rules"
const TOUCH_MS = 3600_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SessionPersonRow = {
  id: string
  name: string
  first_name: string | null
  email: string
  role: string
  is_staff: boolean
  portal_allowed: boolean
}
export type Session = {
  sid: string
  kind: SessionKind
  /** A script invite's session opens one script and nothing else: never treat it as the person elsewhere. */
  scope: Scope | null
  person: SessionPersonRow
  preview: boolean
  demo?: string
}

/** The cookie's token: the `__Host-` name; the plain name ONLY on localhost (built review: anywhere else a sibling
 *  subdomain could toss a domain-wide one at a signed-out visitor). */
export async function sessionToken(): Promise<string | null> {
  const jar = await cookies()
  const secure = jar.get(SESSION_COOKIE_SECURE)?.value
  if (secure) return secure
  const host = ((await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "").split(",")[0].split(":")[0].trim().toLowerCase()
  return host === "localhost" || host === "127.0.0.1" ? jar.get(SESSION_COOKIE_PLAIN)?.value ?? null : null
}

/** A staging preview sign-in (the screenshot harness): read-only everywhere. From the session, not a header. */
export async function isPreviewSession(): Promise<boolean> {
  const s = await sessionUser()
  return !!s && (s.preview || s.kind === "preview")
}

export const sessionUser = cache(async (): Promise<Session | null> => {
  const token = await sessionToken()
  const secret = process.env.SESSION_JWT_SECRET
  if (!token || !secret) return null
  let payload: Record<string, unknown>
  try {
    payload = (await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] })).payload as Record<string, unknown>
  } catch {
    return null
  }
  const sid = typeof payload.sid === "string" && UUID.test(payload.sid) ? payload.sid : null
  if (!sid) return null // a pre-P0 token: signed out once
  const scope = parseScope(payload.scope)
  if (scope === "bad") return null
  const row = await db.portalSession.findUnique({
    where: { id: sid },
    select: {
      revoked_at: true,
      expires_at: true,
      last_active_at: true,
      token_hash: true,
      scope: true,
      kind: true,
      person: { select: { id: true, name: true, first_name: true, email: true, role: true, is_staff: true, portal_allowed: true } },
    },
  })
  const now = Date.now()
  if (rowProblem(row, createHash("sha256").update(token).digest("hex"), scope, now)) return null
  if (!row) return null
  if (!row.last_active_at || now - row.last_active_at.getTime() > TOUCH_MS) {
    await db.portalSession.update({ where: { id: sid }, data: { last_active_at: new Date(now) } }).catch(() => {})
  }
  return {
    sid,
    kind: (["person", "preview", "demo", "script"].includes(row.kind) ? row.kind : "person") as SessionKind,
    scope,
    person: row.person,
    preview: payload.preview === true,
    demo: typeof payload.demo === "string" ? payload.demo : undefined,
  }
})

/** End this session's row (sign-out). */
export async function revokeSession(sid: string): Promise<void> {
  await db.portalSession.updateMany({ where: { id: sid, revoked_at: null }, data: { revoked_at: new Date() } })
}

/** End every live session this person has ("Sign out everywhere"). */
export async function revokeAll(personId: string): Promise<number> {
  const r = await db.portalSession.updateMany({ where: { person_id: personId, revoked_at: null }, data: { revoked_at: new Date() } })
  return r.count
}

/** For long-lived handlers (the Scripts live stream): is this session's row still live? Uncached; the token was
 *  checked when the stream opened. */
export async function sessionStillLive(sid: string): Promise<boolean> {
  const row = await db.portalSession.findUnique({
    where: { id: sid },
    select: { revoked_at: true, expires_at: true, last_active_at: true, token_hash: true, scope: true, person: { select: { portal_allowed: true } } },
  })
  if (!row) return false
  return !rowProblem(row, row.token_hash, row.scope ? { kind: "script", id: row.scope.slice("script:".length) } : null, Date.now())
}
