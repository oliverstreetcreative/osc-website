// Session status for the one sign-in's surfaces (client-website SPEC §27 P1 v2 #3, #5; contract §4). Pure: the route
// does the lookups. A surface calls it before EVERY admin action and when its own session is due a check.
import { createHash, timingSafeEqual } from "crypto"
import { rowProblem, type SessionRow } from "@/lib/auth/session-rules"
import { registry, type IdpClient, type IdpEnv } from "./clients"
import { idpGrade, oscAdmin, type Admission, type OscAdmin } from "./rules"

export type StatusAnswer = { active: boolean; sub: string | null; osc_admin: OscAdmin | null }
export const INACTIVE: StatusAnswer = { active: false, sub: null, osc_admin: null }

/**
 * The answer for one surface: the row must be live (its own rules) and its subject admitted NOW (a switch-off or a
 * lapsed grant counts at once); `osc_admin` follows the 12-hour rule from the row's own sign-in time.
 */
export function statusFor(input: {
  row: (SessionRow & { created_at: Date; kind: string; amr: string | null; subject_id: string | null }) | null
  sub: string | null
  admission: Admission | null
  surface: string
  now: Date
}): StatusAnswer {
  const { row, sub, admission } = input
  if (!row || !sub || !admission || !idpGrade(row) || row.subject_id !== sub) return INACTIVE
  if (rowProblem(row, row.token_hash, null, input.now.getTime(), admission.ok)) return INACTIVE
  if (!admission.ok) return INACTIVE
  return {
    active: true,
    sub,
    osc_admin: oscAdmin({ owner: admission.owner, grants: admission.grants, surface: input.surface, authTime: row.created_at, now: input.now }),
  }
}

/**
 * HTTP Basic client authentication (client_secret_basic; RFC 6749 §2.3.1: id and secret form-urlencoded, then
 * base64). The secret is compared in constant time over hashes, so its length leaks nothing. A secret under 32
 * characters in env counts as unset.
 */
export function basicClient(header: string | null, env: IdpEnv, getEnv: (name: string) => string | undefined): IdpClient | null {
  if (!header || !header.startsWith("Basic ")) return null
  let id: string
  let secret: string
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8")
    const i = decoded.indexOf(":")
    if (i <= 0) return null
    id = decodeURIComponent(decoded.slice(0, i).replace(/\+/g, " "))
    secret = decodeURIComponent(decoded.slice(i + 1).replace(/\+/g, " "))
  } catch {
    return null
  }
  const client = registry(env, getEnv).find((c) => c.client_id === id)
  const want = client ? getEnv(client.secret_env) ?? "" : ""
  // The same work whether or not the client exists.
  const a = createHash("sha256").update(secret).digest()
  const b = createHash("sha256").update(want || "osc-no-such-client").digest()
  const same = timingSafeEqual(a, b)
  return client && want.length >= 32 && same ? client : null
}
