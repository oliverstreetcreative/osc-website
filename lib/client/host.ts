import type { NextRequest } from "next/server"

// Only these hosts may appear in links we email or redirect to. Anything else
// (a forged X-Forwarded-Host) falls back to the login host.
function allowedHost(host: string) {
  const h = host.split(":")[0].toLowerCase()
  return (
    h === "oliverstreetcreative.com" ||
    h.endsWith(".oliverstreetcreative.com") ||
    h === "osc-website-staging.up.railway.app" ||
    h === "localhost" ||
    h === "127.0.0.1"
  )
}
function originFrom(fwdHost: string | null, host: string | null, fwdProto: string | null) {
  const raw = (fwdHost ?? host ?? "").split(",")[0].trim()
  if (!raw || !allowedHost(raw)) return `https://${process.env.LOGIN_HOST ?? "login.oliverstreetcreative.com"}`
  const local = raw.startsWith("localhost") || raw.startsWith("127.")
  const proto = local ? (fwdProto ?? "http").split(",")[0] : "https"
  return `${proto}://${raw}`
}

/** The public origin of this request, from an allowlist (Railway terminates TLS in front of us). */
export function publicOrigin(req: NextRequest | Request): string {
  const h = req.headers
  return originFrom(h.get("x-forwarded-host"), h.get("host"), h.get("x-forwarded-proto"))
}

/**
 * Session cookies are shared across *.oliverstreetcreative.com in production.
 * Anywhere else (the staging service domain, localhost) the browser would
 * reject that domain attribute, so the cookie is host-only there.
 */
export function cookieDomainFor(req: NextRequest | Request): string | undefined {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase()
  return host === "oliverstreetcreative.com" || host.endsWith(".oliverstreetcreative.com")
    ? ".oliverstreetcreative.com"
    : undefined
}

export function isSecure(req: NextRequest | Request) {
  return publicOrigin(req).startsWith("https:")
}

/** Same as publicOrigin, for server components. */
export async function pageOrigin(): Promise<string> {
  const { headers } = await import("next/headers")
  const h = await headers()
  return originFrom(h.get("x-forwarded-host"), h.get("host"), h.get("x-forwarded-proto"))
}
