// The front door's server side (SPEC §27 P0 v2): the device cookie, the counts (one advisory-lock transaction, so a
// parallel burst can't read stale numbers), the alarms, and the two emails (the sign-in link + code; the new-device
// notice). The routes are thin: app/api/auth/{request-magic-link,verify,code}.
import type { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/generated/prisma"
import { db } from "@/lib/db"
import { clientIp } from "@/lib/client/ip"
import { isSecure } from "@/lib/client/host"
import { writeNewFile } from "@/lib/client/dropbox-write"
import { ledgerDir } from "@/lib/client/rehearsal"
import { IS_PRODUCTION, IS_STAGING } from "@/lib/site-env"
import { LINK_LIMITS, alarmFor, countingHash, deviceHash, maySendLink, mayTryCode, newDeviceId, signinIpKey } from "./front-door"
export { homeFor } from "./front-door"
import { DEVICE_COOKIE_MAX_AGE } from "./session"

const LOCK = "SELECT pg_advisory_xact_lock(290430)" // a constant: sign-in's own lock (support reports use 290429)
// Built review: a pile of waiting transactions could park every pooled connection. So the wait is bounded (lock
// timeout), at most a few sign-in transactions run per process, and a network already over its cap never enters.
const LOCK_TIMEOUT = "SET LOCAL lock_timeout = '3s'"
const MAX_IN_FLIGHT = 3
let inFlight = 0

const secret = () => process.env.SESSION_JWT_SECRET || ""

/** The device cookie: `__Host-` wherever the site is served over https (a sibling subdomain can't toss one in and
 *  pin a victim's device; built review); the plain name only on localhost. Not a credential either way. */
export const DEVICE_COOKIE_SECURE = "__Host-osc_device"
export const DEVICE_COOKIE_PLAIN = "osc_device"
const isLocalhost = (req: NextRequest) => {
  const h = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].split(":")[0].trim().toLowerCase()
  return h === "localhost" || h === "127.0.0.1"
}

/** This browser's device id, if it carries a well-formed one. */
export function deviceFrom(req: NextRequest): string | null {
  const v = req.cookies.get(DEVICE_COOKIE_SECURE)?.value ?? (isLocalhost(req) ? req.cookies.get(DEVICE_COOKIE_PLAIN)?.value : undefined) ?? ""
  return /^[A-Za-z0-9_-]{32}$/.test(v) ? v : null
}

/** The browser's device id, minting one (and setting the cookie on `res`) if it has none. */
export function ensureDevice(req: NextRequest, res: NextResponse): string {
  const have = deviceFrom(req)
  if (have) return have
  const id = newDeviceId()
  const secure = isSecure(req)
  res.cookies.set(secure ? DEVICE_COOKIE_SECURE : DEVICE_COOKIE_PLAIN, id, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: DEVICE_COOKIE_MAX_AGE })
  return id
}

export type Hashes = { email: string; ip: string | null; device: string | null }

export function hashesFor(req: NextRequest, email: string, deviceId: string | null): Hashes {
  const ip = clientIp(req.headers)
  return {
    email: countingHash("email", email, secret()),
    ip: ip ? countingHash("ip", signinIpKey(ip), secret()) : null,
    device: deviceId ? deviceHash(deviceId) : null,
  }
}

/** Has this browser signed in as this person before (a person session, live or ended, kept 90 days)? */
async function knownDevice(tx: Pick<typeof db, "portalSession">, personId: string | null, device: string | null) {
  if (!personId || !device) return false
  return (await tx.portalSession.count({ where: { person_id: personId, device_hash: device, kind: "person" } })) > 0
}

/** Run `fn` under the sign-in lock, bounded; `busy` when the lock or the process is too busy (a flood). */
async function locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, busy: T): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) return busy
  inFlight++
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(LOCK_TIMEOUT)
        await tx.$executeRawUnsafe(LOCK)
        return fn(tx)
      },
      { timeout: 10_000, maxWait: 5_000 },
    )
  } catch (err) {
    console.error("sign-in: the counts were too busy to take", String((err as Error)?.message ?? err).slice(0, 200))
    return busy
  } finally {
    inFlight--
  }
}

const hourAgo = () => new Date(Date.now() - 3600_000)

/** Record a link request and decide whether an email goes. The answer to the person is the same either way. A browser
 *  that has signed in as this person before is TRUSTED: it skips the per-address and per-network caps and never
 *  counts toward its network's (built review: a crew on one hotspot must not lock each other out). */
export async function decideLink(h: Hashes, personId: string | null): Promise<{ send: boolean; alarm: string | null }> {
  const known = !!personId
  const trusted = await knownDevice(db, personId, h.device)
  // A network already over its cap never takes the lock (the same answer, no transaction).
  if (!trusted && h.ip) {
    const ipHour = await db.authEvent.count({ where: { kind: "link_request", ip_hash: h.ip, trusted: false, created_at: { gte: hourAgo() } } })
    if (ipHour >= LINK_LIMITS.ipPerHour) return { send: false, alarm: null }
  }
  return locked(async (tx) => {
    const now = Date.now()
    const since = (ms: number) => new Date(now - ms)
    const [address15, addressDay, ipHour, sendsHour] = await Promise.all([
      tx.authEvent.count({ where: { kind: "link_request", email_hash: h.email, created_at: { gte: since(15 * 60_000) } } }),
      tx.authEvent.count({ where: { kind: "link_request", email_hash: h.email, created_at: { gte: since(86400_000) } } }),
      h.ip ? tx.authEvent.count({ where: { kind: "link_request", ip_hash: h.ip, trusted: false, created_at: { gte: since(3600_000) } } }) : 0,
      tx.authEvent.count({ where: { kind: "link_sent", created_at: { gte: since(3600_000) } } }),
    ])
    await tx.authEvent.create({ data: { kind: "link_request", email_hash: h.email, ip_hash: h.ip, device_hash: h.device, known, trusted } })
    const send = known && maySendLink({ address15, addressDay, ipHour, knownDevice: trusted })
    if (send) await tx.authEvent.create({ data: { kind: "link_sent", email_hash: h.email, ip_hash: h.ip, device_hash: h.device, known, trusted } })
    return { send, alarm: send ? alarmFor({ sendsHour: sendsHour + 1, codeFailsDay: 0 }) : null }
  }, { send: false, alarm: null })
}

export type CodeTry = { ok: true } | { ok: false; why: "too_many" }

/** May a code be checked now? The same counting for a real address and an unknown one (nothing says which exists). */
export async function decideCodeTry(h: Hashes, personId: string | null, codeTries: number): Promise<CodeTry> {
  const trusted = await knownDevice(db, personId, h.device)
  return locked(async (tx) => {
    const now = Date.now()
    const [addressFailsDay, ipFailsHour] = await Promise.all([
      tx.authEvent.count({ where: { kind: "code_fail", email_hash: h.email, created_at: { gte: new Date(now - 86400_000) } } }),
      h.ip ? tx.authEvent.count({ where: { kind: "code_fail", ip_hash: h.ip, created_at: { gte: new Date(now - 3600_000) } } }) : 0,
    ])
    return mayTryCode({ codeTries, addressFailsDay, ipFailsHour, knownDevice: trusted }) ? ({ ok: true } as const) : ({ ok: false, why: "too_many" } as const)
  }, { ok: false, why: "too_many" } as CodeTry)
}

/** A wrong code: counted per address and network either way; only a guess at a LIVE code counts toward the alarm. */
export async function recordCodeFail(h: Hashes, live: boolean): Promise<void> {
  await db.authEvent.create({ data: { kind: "code_fail", email_hash: h.email, ip_hash: h.ip, device_hash: h.device, known: live } })
  if (!live) return
  const day = await db.authEvent.count({ where: { kind: "code_fail", known: true, created_at: { gte: new Date(Date.now() - 86400_000) } } })
  const alarm = alarmFor({ sendsHour: 0, codeFailsDay: day })
  if (alarm) raiseAlarm(alarm)
}

export async function recordEvent(kind: "link_ok" | "code_ok", h: Hashes): Promise<void> {
  await db.authEvent.create({ data: { kind, email_hash: h.email, ip_hash: h.ip, device_hash: h.device, known: true } }).catch(() => {})
}

const alarmed = new Set<string>()
/** An alarm is a flag for Majordomo (at most one an hour per kind), never an off switch. */
export function raiseAlarm(what: string): void {
  const hour = new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, "")
  const kind = what.startsWith("sign-in codes") ? "codes" : "links"
  const name = `signin-alarm_${kind}_${hour}.json`
  if (alarmed.has(name)) return
  alarmed.add(name)
  const body = { what: `Sign-in alarm: ${what}. Sign-in keeps working; look at the traffic.`, kind: "signin_alarm", seen_at: new Date().toISOString() }
  void writeNewFile(`${ledgerDir("flags", null, IS_PRODUCTION)}/${name}`, JSON.stringify(body, null, 2) + "\n")
    .then((r) => {
      if (r !== "written" && r !== "exists") console.error(`sign-in: alarm flag write failed: ${r}`)
    })
    .catch((err) => console.error("sign-in: alarm flag write failed", err))
  console.error(`sign-in alarm: ${what}`)
}

/** Staging never emails a client: only OSC addresses there (the standing rule). */
export const mayEmail = (email: string) => !IS_STAGING || email.endsWith("@oliverstreetcreative.com")

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY not configured")
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Oliver Street Creative <portal@send.oliverstreetcreative.com>", to: [to], subject, html }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** The sign-in email: the link (this device) and the code (anywhere else). Sent AFTER the answer; failures are logged. */
export function sendSignIn(to: string, link: string, code: string, minutes: number): void {
  if (!mayEmail(to)) {
    console.log("sign-in: staging, not emailing a non-OSC address")
    return
  }
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p>Here is your link to sign in to Oliver Street Creative. Tap it on the phone or computer where you asked for it.</p>
      <p style="margin: 24px 0;">
        <a href="${esc(link)}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px;">Sign in</a>
      </p>
      <p>Opening this somewhere else, or in your mail app? Type this code instead:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 600; margin: 8px 0 20px;">${esc(spaced)}</p>
      <p style="color: #666; font-size: 13px;">The link and the code work once, for ${minutes} minutes. If you didn't ask for this, you can ignore it.</p>
    </div>`
  void sendEmail(to, `Your Oliver Street Creative sign-in: ${spaced}`, html).catch((err) => console.error("sign-in: send failed:", err))
}

/** The new-device notice (P0 #10): only for a person session on a device this person hasn't used in 90 days. */
export async function noticeIfNewDevice(person: { id: string; email: string }, deviceId: string | null, label: string, sid: string): Promise<void> {
  if (!deviceId) return
  const seen = await db.portalSession.count({
    where: { person_id: person.id, device_hash: deviceHash(deviceId), kind: "person", id: { not: sid }, created_at: { gte: new Date(Date.now() - 90 * 86400_000) } },
  })
  if (seen || !mayEmail(person.email)) return
  const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p>New sign-in to your Oliver Street account: <b>${esc(label)}</b>, ${esc(when)} Eastern.</p>
      <p>Not you? Text Sam at 859-512-1419 and he'll sign you out everywhere.</p>
    </div>`
  void sendEmail(person.email, "New sign-in to your Oliver Street account", html).catch((err) => console.error("sign-in: notice failed:", err))
}

/** The 5-minute run's clean-up: counts older than 3 days; session rows that ended more than 90 days ago. */
export async function cleanUpFrontDoor(): Promise<void> {
  const now = Date.now()
  await db.authEvent.deleteMany({ where: { created_at: { lt: new Date(now - 3 * 86400_000) } } })
  await db.portalSession.deleteMany({
    where: { OR: [{ expires_at: { lt: new Date(now - 90 * 86400_000) } }, { revoked_at: { lt: new Date(now - 90 * 86400_000) } }] },
  })
}
