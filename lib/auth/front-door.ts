// The front door's pure rules (SPEC §27 P0): where a sign-in may send someone, what a script-only session may reach,
// the limits on link requests and code tries, and the 6-digit code. No database, no Next: unit-tested in
// front-door.test.ts. The routes and the middleware do the I/O and call these.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto"

// The path rules live in ./paths (Edge-safe: the middleware imports them); re-exported here for the routes and tests.
export { safeRedirect, parseScope, scopeAllows, type Scope } from "./paths"

// ---------------------------------------------------------------- limits (counted in Postgres, under one lock)

export const LINK_LIMITS = { addressPer15Min: 3, addressPerDay: 10, ipPerHour: 10 } as const
export const CODE_LIMITS = { triesPerCode: 5, addressFailsPerDay: 15, ipFailsPerHour: 30 } as const
/** Global numbers are ALARMS (a flag for Majordomo), never off switches (review 10/4: junk traffic from a /48 must
 *  not switch sign-in off for everyone). */
export const ALARMS = { sendsPerHour: 300, codeFailsPerDay: 500 } as const

/**
 * Send a link? The answer to the person is the same either way; this only decides whether an email goes. A browser
 * that has signed in as this person before (`knownDevice`) skips the per-address AND per-network caps: nobody can lock
 * someone out by asking for their links, and a crew on one hotspot can't lock each other out (design + built review).
 * `ipHour` counts only requests from devices that aren't known.
 */
export function maySendLink(c: { address15: number; addressDay: number; ipHour: number; knownDevice?: boolean }): boolean {
  if (c.knownDevice) return true
  if (c.ipHour >= LINK_LIMITS.ipPerHour) return false
  return c.address15 < LINK_LIMITS.addressPer15Min && c.addressDay < LINK_LIMITS.addressPerDay
}

/** Check a typed code at all? Past any cap: "Too many tries. Ask for a new link, or text Sam." */
export function mayTryCode(c: { codeTries: number; addressFailsDay: number; ipFailsHour: number; knownDevice?: boolean }): boolean {
  if (c.codeTries >= CODE_LIMITS.triesPerCode || c.ipFailsHour >= CODE_LIMITS.ipFailsPerHour) return false
  return c.knownDevice ? true : c.addressFailsDay < CODE_LIMITS.addressFailsPerDay
}

/** Which alarm, if any, these global counts cross (it raises a flag; sign-in keeps working). */
export function alarmFor(c: { sendsHour: number; codeFailsDay: number }): string | null {
  if (c.sendsHour >= ALARMS.sendsPerHour) return `sign-in links: ${c.sendsHour} sent in the last hour`
  if (c.codeFailsDay >= ALARMS.codeFailsPerDay) return `sign-in codes: ${c.codeFailsDay} wrong guesses in the last day`
  return null
}

/** What a sign-in counts an address under: an IPv4 as itself; an IPv6 by its /48 (one site's whole allocation:
 *  stricter than the /64 support reports use, because a /48 holds 65,536 /64s). Unparseable counts as itself. */
export function signinIpKey(ip: string): string {
  const s = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  if (!s.includes(":")) return s
  if (s.includes(".")) return s.slice(s.lastIndexOf(":") + 1)
  const halves = s.split("::")
  if (halves.length > 2) return s
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const fill = halves.length === 2 ? Array<string>(Math.max(0, 8 - head.length - tail.length)).fill("0") : []
  const g = [...head, ...fill, ...tail]
  if (g.length !== 8 || g.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return s
  return g.slice(0, 3).map((x) => parseInt(x, 16).toString(16)).join(":") + "::/48"
}

/** An HMAC for counting only (addresses, IPs, devices): the thing itself is never stored. */
export function countingHash(kind: "email" | "ip" | "device", value: string, key: string): string {
  return createHmac("sha256", `osc-signin-${kind}:${key}`).update(value.trim().toLowerCase()).digest("hex").slice(0, 32)
}

// ---------------------------------------------------------------- the 6-digit code

/** Six digits from the CSPRNG ("004219" is a code like any other). */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0")

/** Only digits count ("123 456", "123-456" and a pasted "123456" are the same code); anything else is null. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const d = raw.replace(/[\s-]/g, "")
  return /^\d{6}$/.test(d) ? d : null
}

/** The code as stored: an HMAC bound to its invite, so a database read alone can't sign anyone in. */
export function codeHash(inviteId: string, code: string, key: string): string {
  return createHmac("sha256", `osc-signin-code:${key}`).update(`${inviteId}:${code}`).digest("hex")
}

/** Constant-time check of a typed code against the stored hash. */
export function codeMatches(stored: string | null | undefined, inviteId: string, code: string, key: string): boolean {
  if (!stored || !/^[0-9a-f]{64}$/.test(stored)) return false
  const a = Buffer.from(stored, "hex")
  const b = Buffer.from(codeHash(inviteId, code, key), "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

/** An address for counting only: an HMAC of the lower-cased address, never the address. */
export const emailHash = (email: string, key: string) => countingHash("email", email, key)

/** A device id (the osc_device cookie) as stored on an invite or a session: a full sha256, compared exactly. */
export const deviceHash = (deviceId: string) => createHash("sha256").update(`osc-device:${deviceId}`).digest("hex")

/** A fresh device id for the osc_device cookie (not a credential: it only pairs a tap with the browser that asked). */
export const newDeviceId = () => randomBytes(24).toString("base64url")

/** Where a person lands after signing in, when nothing asked for a page. On crew.* everyone lands on the crew home
 *  (built review: staff landing on /client/view-as there hit /crew/client/view-as, a 404). */
export function homeFor(role: string, isStaff: boolean, host: string): string {
  if (host.startsWith("crew.")) return "/"
  if (isStaff || role === "STAFF") return host.startsWith("login.") ? "/admin" : "/client/view-as"
  if (role === "CREW") return "/crew"
  return "/client"
}
