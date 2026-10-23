// The front door's PATH rules (SPEC §27 P0 v2): where a sign-in may land, and what a script-invite session may reach.
// No imports at all, so the Edge middleware can use them; lib/auth/front-door.ts re-exports them for the routes.

// ---------------------------------------------------------------- where a sign-in lands

const LANDING = /^\/(client|crew|admin)(\/|$)/
export const hasControl = (s: string) => [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)

/**
 * A destination after sign-in (P0 #1): a path on THIS host under /client, /crew or /admin, with its query, never its
 * hash. Anything else (another host, a scheme, "//x", "/\x", encoded tricks, control characters) is null, and the
 * person lands on their role's home instead.
 */
export function safeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 512) return null
  let p = raw.trim()
  try {
    p = decodeURIComponent(p) // judged decoded: "/%2F%2Fevil.example" is "//evil.example"
  } catch {
    return null
  }
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || hasControl(p)) return null
  let u: URL
  try {
    u = new URL(p, "https://door.invalid")
  } catch {
    return null
  }
  if (u.origin !== "https://door.invalid") return null
  if (!LANDING.test(u.pathname)) return null // the URL parser already resolved any dot segments
  return u.pathname + u.search
}

// ---------------------------------------------------------------- a session that opens one script

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type Scope = { kind: "script"; id: string }

/** The `scope` claim: absent → null (a full session); "script:<uuid>" → the scope; anything else → "bad" (no session). */
export function parseScope(raw: unknown): Scope | null | "bad" {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== "string") return "bad"
  const m = /^script:(.+)$/.exec(raw)
  return m && UUID.test(m[1]) ? { kind: "script", id: m[1].toLowerCase() } : "bad"
}

/** Paths every session may reach, scoped or not: assets, signing in and out, and reporting a problem. Never all of
 *  /api/auth/ (review 10/4: a future route there would open to a forwarded invite). */
function infra(p: string) {
  return (
    p.startsWith("/_next/") ||
    p.startsWith("/favicon") ||
    p === "/api/auth/logout" ||
    p === "/login" ||
    p === "/magic" ||
    p === "/support/signin-trouble"
  )
}

/**
 * May a script-invite session (P0 #6) request this path? `pathname` is the path the APP serves (on client.* that's
 * after the middleware's /client rewrite). Only its own script, its print view and its API, plus signing out, the
 * device list and reporting a problem. Everything else needs a real sign-in.
 */
export function scopeAllows(scope: Scope, pathname: string): boolean {
  let p: string
  try {
    p = decodeURIComponent(pathname).toLowerCase()
  } catch {
    return false
  }
  if (p.includes("..") || p.includes("//") || p.includes("\\") || hasControl(p)) return false
  p = p.replace(/\/+$/, "") || "/"
  const s = `/client/scripts/${scope.id}`
  return (
    p === s ||
    p === `${s}/print` ||
    p === `/api/scripts/${scope.id}` || // the editor's settings PATCH
    p.startsWith(`/api/scripts/${scope.id}/`) ||
    p === "/client/signout" ||
    p === "/client/account" ||
    p === "/client/support/report" ||
    infra(p)
  )
}

