import type { NextRequest } from "next/server"
import { IS_PRODUCTION } from "@/lib/site-env"

// Only these hosts may appear in links we email or redirect to. Anything else (a forged X-Forwarded-Host) falls back
// to the login host. Production: EXACTLY the hosts this app serves, never "any subdomain" (SPEC §27 P0 v2 #8), and
// never the staging host or localhost.
const SERVED = new Set([
  "oliverstreetcreative.com",
  "www.oliverstreetcreative.com",
  "client.oliverstreetcreative.com",
  "crew.oliverstreetcreative.com",
  "login.oliverstreetcreative.com",
  "village.oliverstreetcreative.com",
])
function allowedHost(host: string) {
  const h = host.split(":")[0].toLowerCase()
  if (SERVED.has(h)) return true
  if (IS_PRODUCTION) return false
  return h.endsWith(".oliverstreetcreative.com") || h === "osc-website-staging.up.railway.app" || h === "localhost" || h === "127.0.0.1"
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

const LEGACY_DOMAIN = ".oliverstreetcreative.com"
const hostOf = (req: NextRequest | Request) =>
  (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].split(":")[0].trim().toLowerCase()

/**
 * Session cookies are HOST-ONLY (10/3 design review): a cookie scoped to all of
 * .oliverstreetcreative.com would also be sent to review., hub., blog. and every
 * other subdomain's server. Set SESSION_COOKIE_DOMAIN only if a legacy flow
 * (the crew portal on crew.*) really needs one session across subdomains.
 */
export function cookieDomainFor(req: NextRequest | Request): string | undefined {
  const forced = process.env.SESSION_COOKIE_DOMAIN?.trim()
  if (!forced) return undefined
  const host = hostOf(req)
  return host === forced.replace(/^\./, "") || host.endsWith(forced.startsWith(".") ? forced : `.${forced}`) ? forced : undefined
}

/**
 * Domains to clear a cookie on at sign-out: host-only, plus the old
 * domain-wide cookie that sessions issued before 10/3 may still carry.
 */
export function cookieDomainsToClear(req: NextRequest | Request): (string | undefined)[] {
  const host = hostOf(req)
  const out: (string | undefined)[] = [undefined]
  if (host === "oliverstreetcreative.com" || host.endsWith(LEGACY_DOMAIN)) out.push(LEGACY_DOMAIN)
  const forced = cookieDomainFor(req)
  if (forced && !out.includes(forced)) out.push(forced)
  return out
}

/**
 * Expire cookies on every domain they may live on. Raw Set-Cookie headers,
 * because Next's cookie API keeps only one entry per name.
 */
export function clearCookies(res: Response, req: NextRequest | Request, names: string[]) {
  const secure = isSecure(req) ? "; Secure" : ""
  for (const name of names) {
    for (const domain of cookieDomainsToClear(req)) {
      res.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}${domain ? `; Domain=${domain}` : ""}`,
      )
    }
  }
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
