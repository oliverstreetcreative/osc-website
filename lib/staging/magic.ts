// Gate-only email ownership proof. I/O is injected so tests cannot email or touch a DB.
import { createHash, randomBytes, randomUUID } from "crypto"
import { codeHash, codeMatches, deviceHash, newCode, normalizeCode } from "../auth/front-door"
import { GATE_MAGIC, safeNext, signingKeyUsable, stagingEmail } from "./gate"

export const LINK_MINUTES = 15
export const MAX_CODE_TRIES = 5
export type AccessLink = {
  id: string; token_hash: string; email: string; origin: string; next_path: string
  device_hash: string; code_hash: string; code_tries: number
  expires_at: Date; consumed_at: Date | null; created_at: Date
}
export type MagicDeps = {
  staging: boolean; key: string; now: () => number
  store: {
    create: (link: AccessLink) => Promise<void>
    byToken: (hash: string) => Promise<AccessLink | null>
    byEmail: (email: string, origin: string) => Promise<AccessLink | null>
    consume: (id: string, now: Date) => Promise<boolean>
    failCode: (id: string, now: Date) => Promise<void>
  }
  allowLink: (email: string) => Promise<boolean>
  allowCode: (email: string, tries: number) => Promise<boolean>
  recordCodeFailure: (email: string) => Promise<void>
  send: (email: string, link: string, code: string, minutes: number) => Promise<void> | void
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex")
const ready = (d: MagicDeps) => d.staging && !!signingKeyUsable(d.key)
const live = (row: AccessLink | null, origin: string, now: number): row is AccessLink =>
  !!row && stagingEmail(row.email) !== null && row.origin === origin && !row.consumed_at && row.expires_at.getTime() > now && row.code_tries < MAX_CODE_TRIES

export async function requestLink(rawEmail: unknown, next: unknown, origin: string, device: string, d: MagicDeps) {
  if (!ready(d)) return "closed"
  const email = stagingEmail(rawEmail)
  if (!email) return "invalid"
  if (!(await d.allowLink(email))) return "sent" // same response when capped
  const token = randomBytes(32).toString("hex")
  const code = newCode()
  const now = d.now()
  const id = randomUUID()
  await d.store.create({
    id, token_hash: hash(token), email, origin, next_path: safeNext(next),
    device_hash: deviceHash(device), code_hash: codeHash(id, code, d.key), code_tries: 0,
    expires_at: new Date(now + LINK_MINUTES * 60_000), consumed_at: null, created_at: new Date(now),
  })
  await d.send(email, `${origin}${GATE_MAGIC}?token=${token}`, code, LINK_MINUTES)
  return "sent"
}

export type Verified = { ok: true; next: string } | { ok: false; why: "invalid" | "code" }
export async function verifyLink(token: unknown, origin: string, device: string | null, d: MagicDeps): Promise<Verified> {
  if (!ready(d) || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return { ok: false, why: "invalid" }
  const row = await d.store.byToken(hash(token))
  const now = d.now()
  if (!live(row, origin, now)) return { ok: false, why: "invalid" }
  // GET does nothing. A scanner/forward/mail-app without the requesting device
  // cannot spend the link; the code in that email works on another device.
  if (!device || deviceHash(device) !== row.device_hash) return { ok: false, why: "code" }
  if (!(await d.store.consume(row.id, new Date(now)))) return { ok: false, why: "invalid" }
  return { ok: true, next: safeNext(row.next_path) }
}

export async function verifyCode(rawEmail: unknown, rawCode: unknown, origin: string, d: MagicDeps): Promise<Verified> {
  if (!ready(d)) return { ok: false, why: "invalid" }
  const email = stagingEmail(rawEmail)
  const code = normalizeCode(rawCode)
  if (!email || !code) return { ok: false, why: "invalid" }
  const row = await d.store.byEmail(email, origin)
  const now = d.now()
  if (!(await d.allowCode(email, row?.code_tries ?? 0))) return { ok: false, why: "invalid" }
  if (!live(row, origin, now) || !codeMatches(row.code_hash, row.id, code, d.key)) {
    if (row && live(row, origin, now)) await d.store.failCode(row.id, new Date(now))
    await d.recordCodeFailure(email)
    return { ok: false, why: "invalid" }
  }
  if (!(await d.store.consume(row.id, new Date(now)))) return { ok: false, why: "invalid" }
  return { ok: true, next: safeNext(row.next_path) }
}
