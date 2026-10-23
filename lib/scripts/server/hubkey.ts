// The hub's key to one script for one shoot date (SPEC §14 v4 #9; proposal client-website-20261003-0920-hub-contract).
// Server to server, in a header (`X-Script-Key: <key id>.<secret>`), never in a URL. Derived, not stored: HMAC of
// script + date + key generation under SCRIPT_HUB_SECRET, so rotating that secret (or bumping GEN) kills every key.
// A key stops working when the script is archived, and 14 days after its shoot date.
import { createHmac, timingSafeEqual } from "crypto"

const GEN = "k1"
const DATE = /^\d{4}-\d{2}-\d{2}$/
const GRACE_DAYS = 14

function secret(): string | null {
  const s = process.env.SCRIPT_HUB_SECRET?.trim() ?? ""
  return s.length >= 32 ? s : null
}

const mac = (key: string, scriptId: string, date: string, gen: string) =>
  createHmac("sha256", key).update(`${scriptId}|${date}|${gen}`).digest("base64url")

export const hubKeysOn = () => secret() !== null

/** The key for one script on one shoot date (YYYY-MM-DD), or null when the secret isn't set. */
export function mintHubKey(scriptId: string, date: string): string | null {
  const key = secret()
  if (!key || !DATE.test(date)) return null
  return `${GEN}-${date}.${mac(key, scriptId, date, GEN)}`
}

/** The shoot date a header's key opens this script for, or null (wrong script, wrong secret, expired, malformed). */
export function verifyHubKey(scriptId: string, header: string | null, now = new Date()): string | null {
  const key = secret()
  if (!key || !header) return null
  const m = /^(k\d+)-(\d{4}-\d{2}-\d{2})\.([A-Za-z0-9_-]{20,})$/.exec(header.trim())
  if (!m || m[1] !== GEN) return null
  const [, gen, date, given] = m
  const want = Buffer.from(mac(key, scriptId, date, gen))
  const got = Buffer.from(given)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  const expires = new Date(`${date}T00:00:00Z`)
  expires.setUTCDate(expires.getUTCDate() + GRACE_DAYS + 1)
  return now < expires ? date : null
}
