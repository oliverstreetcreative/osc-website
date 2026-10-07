// What the IdP tells a surface about a sign-in (contract §2; SPEC §27 P1 v2 #5). Pure, so the provider's glue stays
// thin: the glue hands `loginFrom` to the library when an interaction finishes, and `accountClaims` to its
// findAccount. No database, no library.
import { idpGrade, normEmail, oscAdmin, type Admission, type OscAdmin } from "./rules"

export type IdpLogin = { accountId: string; ts: number; amr: string[] }

/**
 * The login a finished interaction hands the provider: the ROW's own sign-in time and proof, never "now" (v2 #5:
 * continuing on an existing sign-in must not reset `auth_time`, or the 12-hour rule means nothing). Null for a row the
 * IdP can't stand behind (a script invite, a preview, the demo, a row from before p1a).
 */
export function loginFrom(row: { kind: string; amr: string | null; subject_id: string | null; created_at: Date }): IdpLogin | null {
  if (!idpGrade(row)) return null
  return { accountId: row.subject_id!, ts: Math.floor(row.created_at.getTime() / 1000), amr: [row.amr!] }
}

export type AccountClaims = { sub: string; email: string; email_verified: true; name: string; osc_admin?: OscAdmin }

/**
 * The account's claims for ONE relying party (contract §2). `email_verified` is always true (they proved the address
 * by link or code). `name` is the person's own; a deputy with no person record is named by their address, never by a
 * guess. `osc_admin` is present only for the owner or a grant covering this surface, and only while the sign-in
 * (`authTime`, the original) is under 12 hours old. Null when the subject isn't admitted NOW.
 */
export function accountClaims(input: {
  sub: string
  email: string
  name: string | null
  admission: Admission
  surface: string
  authTime: Date
  now: Date
}): AccountClaims | null {
  if (!input.admission.ok) return null
  const email = normEmail(input.email)
  const admin = oscAdmin({ owner: input.admission.owner, grants: input.admission.grants, surface: input.surface, authTime: input.authTime, now: input.now })
  return { sub: input.sub, email, email_verified: true, name: input.name?.trim() || email, ...(admin ? { osc_admin: admin } : {}) }
}
