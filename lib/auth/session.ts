// The ONE place a session is minted (SPEC §27 P0 v2): the link's tap, the code, a script invite's tap, the staging
// preview harness and the demo. A row first-class in portal_sessions behind every cookie: the id is made here, the
// JWT carries it as `sid`, and the row is inserted with its token hash (never null: §26's old-reads check needs it).
// The JWT keeps its claims (id, email, role, is_staff, preview, demo) as the Edge middleware's cheap pre-filter; the
// ROW is the authority on the server (lib/auth/require-session.ts).
import type { NextRequest, NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
import { SignJWT } from "jose"
import { db } from "@/lib/db"
import { isSecure } from "@/lib/client/host"
import { clientIp } from "@/lib/client/ip"
import { REHEARSAL_PREFIX } from "@/lib/client/rehearsal"
import { IS_STAGING } from "@/lib/site-env"
import { deviceOf } from "@/lib/support/safety"
import { countingHash, deviceHash, signinIpKey } from "./front-door"
import { subjectFor } from "@/lib/idp/subjects"

/** `__Host-` wherever the site is served over https: no subdomain's domain-wide cookie can override it (review 10/4). */
export const SESSION_COOKIE_SECURE = "__Host-osc_session"
export const SESSION_COOKIE_PLAIN = "osc_session" // http localhost only
export const sessionCookieName = (secure: boolean) => (secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN)
/** The device cookie's life (the cookie itself: lib/auth/door.ts, `__Host-osc_device` on https). */
export const DEVICE_COOKIE_MAX_AGE = 400 * 86400

export type SessionKind = "person" | "preview" | "demo" | "script"
const TTL_SECONDS: Record<SessionKind, number> = { person: 90 * 86400, preview: 12 * 3600, demo: 7 * 86400, script: 30 * 86400 }

export type SessionPerson = { id: string; email: string; role: string; is_staff: boolean }
export type StartOptions = {
  kind?: SessionKind
  /** "script:<uuid>" for a script invite's session: it opens that script and nothing else. */
  scope?: string
  ttlSeconds?: number
  /** The browser's osc_device cookie, if it has one (the devices page; the new-device notice). */
  deviceId?: string | null
  /** Extra claims for the middleware's pre-filter: { preview: true } or { demo: <fingerprint> }. */
  claims?: Record<string, unknown>
  /** How this sign-in proved itself (SPEC §27 P1 v2 #5): link | code | invite | preview | demo. */
  amr: "link" | "code" | "invite" | "preview" | "demo"
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

/** "iPhone · Safari", "Mac · Chrome", "Android phone · Chrome": enums only, never the user-agent string. */
export function deviceLabel(ua: string | null | undefined): string {
  const d = deviceOf(ua)
  const what =
    d.os === "ios" ? (d.device === "tablet" ? "iPad" : "iPhone")
    : d.os === "android" ? (d.device === "tablet" ? "Android tablet" : "Android phone")
    : d.os === "macos" ? "Mac"
    : d.os === "windows" ? "Windows PC"
    : d.os === "linux" ? "Linux"
    : d.device === "phone" ? "Phone" : "Computer"
  const how = { safari: "Safari", chrome: "Chrome", firefox: "Firefox", edge: "Edge", other: "a browser" }[d.browser]
  return `${what} · ${how}`
}

/** Start a session on `res` for `person`. Returns the new session id. */
export async function startSession(req: NextRequest, res: NextResponse, person: SessionPerson, opts: StartOptions): Promise<{ sid: string }> {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error("SESSION_JWT_SECRET not configured")
  const kind = opts.kind ?? "person"
  const sid = randomUUID()
  const expires = new Date(Date.now() + (opts.ttlSeconds ?? TTL_SECONDS[kind]) * 1000)
  // A script invite's token carries NO `id`: older code (a rollback) can't read it as the person (review 10/4).
  const claims =
    kind === "script"
      ? { sid, kind, scope: opts.scope }
      : { sid, kind, id: person.id, email: person.email, role: person.role, is_staff: person.is_staff }
  const jwt = await new SignJWT({ ...claims, ...(opts.claims ?? {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(new TextEncoder().encode(secret))
  const ip = clientIp(req.headers)
  // Every session belongs to the one sign-in's subject (SPEC §27 P1 v2 #4): a stable `sub` per address.
  const subject = await subjectFor({ email: person.email, personId: person.id })
  await db.portalSession.create({
    data: {
      id: sid,
      person_id: person.id,
      subject_id: subject.id,
      amr: opts.amr,
      token_hash: sha256(jwt),
      expires_at: expires,
      last_active_at: new Date(),
      kind,
      scope: opts.scope ?? null,
      device_hash: opts.deviceId ? deviceHash(opts.deviceId) : null,
      device_label: deviceLabel(req.headers.get("user-agent")),
      ip_hash: ip ? countingHash("ip", signinIpKey(ip), secret) : null,
    },
  })
  const secure = isSecure(req)
  res.cookies.set(sessionCookieName(secure), jwt, { path: "/", httpOnly: true, sameSite: "lax", secure, expires })
  // The other name goes through the same cookie API: Next rebuilds every Set-Cookie header from it on each set, so a
  // raw header appended here would vanish at the caller's next res.cookies.set. (Sign-out clears everything, raw, last.)
  if (secure) res.cookies.set(SESSION_COOKIE_PLAIN, "", { path: "/", maxAge: 0 })
  return { sid }
}

/** Where a client goes after signing in: the portal, or, for someone whose only business with us is a script
 *  (an invitee with no organization: Mike, a freelancer), their scripts (SPEC §14 phone moment 2). */
export async function clientHome(personId: string): Promise<string> {
  // A hidden org (a retired book) or a rehearsal org off staging counts for nothing (as in getClientContext; demo
  // orgs are hidden by the sync wherever the demo is off), so a script-only person still lands on their scripts
  // (SPEC §22 v2.1 review).
  const orgs = await db.membership.count({
    where: {
      person_id: personId,
      hidden: false,
      organization: { hidden: false, ...(IS_STAGING ? {} : { NOT: { slug: { startsWith: REHEARSAL_PREFIX } } }) },
    },
  })
  if (orgs) return "/client"
  const scripts = await db.scriptAccess.count({ where: { person_id: personId, revoked_at: null } })
  return scripts ? "/client/scripts" : "/client"
}
