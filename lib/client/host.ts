import type { NextRequest } from "next/server"

/** The public origin of this request (Railway terminates TLS in front of us). */
export function publicOrigin(req: NextRequest | Request): string {
  const h = req.headers
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "oliverstreetcreative.com"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto.split(",")[0]}://${host.split(",")[0]}`
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
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "oliverstreetcreative.com"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto.split(",")[0]}://${host.split(",")[0]}`
}
