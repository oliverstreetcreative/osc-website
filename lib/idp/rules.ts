// The one sign-in's pure rules (client-website SPEC §27 P1 v2): who is admitted, what `osc_admin` says and for how
// long, the owner's step-up, and what a deputy grant may be. No database, no Next: unit-tested in rules.test.ts.

export const ADMIN_HOURS = 12 // osc_admin rides only while the sign-in is this young (Sign Here's R6), at the IdP
export const STEP_UP_MS = 10 * 60_000 // the deputies page wants a link or code sign-in this fresh
export const GRANT_MAX_DAYS = 90
export const SURFACES = ["sign"] as const // v1: deputies act on Sign Here only
export type Surface = (typeof SURFACES)[number] | "hub" | "review"

export const normEmail = (e: string) => e.trim().toLowerCase()

/** Only real sign-ins are IdP sessions: a person's, or (P1a part 2) a person-less deputy's "subject" row. Never a
 *  script invite's, a preview's or the demo's. */
export const IDP_KINDS = new Set(["person", "subject"])
/** How an IdP sign-in proved the address (contract §2 `amr`). A row with no `amr` predates p1a: P0 didn't record
 *  whether it was a link or a code, so the IdP asks for a fresh one rather than guess (decided 10/6). */
export const IDP_AMR = new Set(["link", "code"])

/** Is this session row one the IdP can stand behind: a real sign-in, with its subject and its proof recorded? */
export function idpGrade(row: { kind: string; amr: string | null; subject_id: string | null }): boolean {
  return IDP_KINDS.has(row.kind) && !!row.amr && IDP_AMR.has(row.amr) && !!row.subject_id
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const JOB = /^\d{2}-\d{3}$/

export type GrantLite = { email: string; surfaces: string[]; scope: "all" | string[]; until: Date; revoked_at: Date | null }

export type Admission =
  | { ok: true; personId: string | null; owner: boolean; grants: GrantLite[] }
  | { ok: false; why: "switched_off" | "unknown" }

/**
 * Who may sign in (P1 v2 #2), checked at sign-in AND on every authorization and session-status call. A switched-off
 * person is a HARD deny everywhere, whatever else they are; otherwise a portal-allowed person, the owner, or someone
 * with a live deputy grant.
 */
export function admit(input: { person: { id: string; portal_allowed: boolean } | null; owner: boolean; grants: GrantLite[]; now: Date }): Admission {
  if (input.person && !input.person.portal_allowed) return { ok: false, why: "switched_off" }
  const live = input.grants.filter((g) => !g.revoked_at && g.until > input.now)
  if (input.person || input.owner || live.length) return { ok: true, personId: input.person?.id ?? null, owner: input.owner, grants: live }
  return { ok: false, why: "unknown" }
}

export type OscAdmin = { role: "owner" | "deputy"; surfaces: string[]; scope: "all" | string[]; until: string }

/**
 * The `osc_admin` claim for one surface (P1 v2 #5): the owner, or the live grants that cover this surface, and ONLY
 * while the sign-in itself is under 12 hours old. Its `until` is the EARLIEST end among those grants and that 12
 * hours: with two grants, the merged scope never outlives the shorter one (10/6). After it, the next session-status
 * call answers with what is still live.
 */
export function oscAdmin(input: { owner: boolean; grants: GrantLite[]; surface: string; authTime: Date; now: Date }): OscAdmin | null {
  const sessionEnd = new Date(input.authTime.getTime() + ADMIN_HOURS * 3600_000)
  if (input.now >= sessionEnd || input.now < input.authTime) return null
  if (input.owner) return { role: "owner", surfaces: [input.surface], scope: "all", until: sessionEnd.toISOString() }
  const covering = input.grants.filter((g) => !g.revoked_at && g.until > input.now && g.surfaces.includes(input.surface))
  if (!covering.length) return null
  const all = covering.some((g) => g.scope === "all")
  const jobs = all ? "all" : [...new Set(covering.flatMap((g) => (Array.isArray(g.scope) ? g.scope : [])))].sort()
  const grantEnd = new Date(Math.min(...covering.map((g) => g.until.getTime())))
  const until = grantEnd < sessionEnd ? grantEnd : sessionEnd
  return { role: "deputy", surfaces: [input.surface], scope: jobs, until: until.toISOString() }
}

/** The owner's step-up (P1 v2 #5): a sign-in that proved the mailbox (a link or the code) under 10 minutes ago. */
export function stepUpFresh(row: { created_at: Date; amr: string | null }, now: Date): boolean {
  const age = now.getTime() - row.created_at.getTime()
  return (row.amr === "link" || row.amr === "code") && age >= 0 && age < STEP_UP_MS
}

export type GrantInput = { email: unknown; scope: unknown; until: unknown; reason: unknown }
export type GrantClean = { email: string; scope: "all" | string[]; until: Date; reason: string | null }

/** Why a grant was refused, as a code the page maps to words (a crafted link can't put text on the owner's page). */
export const GRANT_ERRORS = {
  email: "That isn't an email address.",
  owner: "You're the owner already.",
  scope: "Jobs are codes like 26-012, separated by commas (or leave it as all).",
  until: "Pick the last day it lasts.",
  past: "The last day has to be in the future.",
  max: `At most ${GRANT_MAX_DAYS} days.`,
} as const
export type GrantError = keyof typeof GRANT_ERRORS

/** What a deputy grant may be (P1 v2 #8): a real address, "all" or job codes, an end in the future but within 90 days. */
export function cleanGrant(input: GrantInput, ownerEmail: string, now: Date): { ok: true; grant: GrantClean } | { ok: false; code: GrantError; why: string } {
  const no = (code: GrantError) => ({ ok: false as const, code, why: GRANT_ERRORS[code] })
  const email = typeof input.email === "string" ? normEmail(input.email) : ""
  if (!EMAIL.test(email) || email.length > 254) return no("email")
  if (email === normEmail(ownerEmail)) return no("owner")
  let scope: "all" | string[]
  const raw = typeof input.scope === "string" ? input.scope.trim() : ""
  if (raw === "" || raw.toLowerCase() === "all") scope = "all"
  else {
    const codes = raw.split(/[\s,]+/).filter(Boolean)
    if (!codes.length || codes.some((c) => !JOB.test(c))) return no("scope")
    scope = [...new Set(codes)].sort()
  }
  const until = typeof input.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.until) ? new Date(`${input.until}T23:59:59-05:00`) : null
  if (!until || Number.isNaN(until.getTime())) return no("until")
  if (until <= now) return no("past")
  if (until.getTime() - now.getTime() > GRANT_MAX_DAYS * 86400_000) return no("max")
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, 200) : null
  return { ok: true, grant: { email, scope, until, reason } }
}
