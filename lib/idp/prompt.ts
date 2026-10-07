// The IdP's own login check (SPEC §27 P1 v2 #3, review MUST-FIX 1): the apex session ROW is the session. Every
// authorization asks it, `prompt=none` included, so a sign-out, a switch-off or a lapsed grant ends the library's
// session as well, and a tossed or stale library cookie can never sign anyone in. Pure: the glue loads the row (from
// the `__Host-osc_session` cookie) and the admission, and asks for a sign-in whenever this says why.
import { rowProblem, type SessionRow } from "@/lib/auth/session-rules"
import { idpGrade, normEmail } from "./rules"

export type LoginReason =
  | "no_session" // no apex cookie, or no row behind it
  | "row" // the row is signed out, expired, idle, or not this cookie's
  | "not_idp" // a script invite's, a preview's or the demo's row, or one from before p1a: sign in afresh
  | "not_admitted" // switched off, or nothing admits them any more (a lapsed grant)
  | "other_account" // the library's session is someone else's: the apex says who is signed in, not the library
  | "hint" // the surface expects someone else (login_hint): ask, don't sign in the wrong person

export function loginNeeded(input: {
  row: (SessionRow & { kind: string; amr: string | null; subject_id: string | null }) | null
  /** The hash of the token in the presented `__Host-osc_session` cookie; null when there is none. */
  tokenHash: string | null
  admitted: boolean
  /** The library session's account, when it has one. */
  accountId: string | null
  loginHint: string | null
  /** The row's subject's address. */
  subjectEmail: string | null
  now: number
}): LoginReason | null {
  const { row } = input
  if (!row || !input.tokenHash) return "no_session"
  if (rowProblem(row, input.tokenHash, null, input.now, true)) return "row"
  if (!idpGrade(row)) return "not_idp"
  if (!input.admitted) return "not_admitted"
  if (input.accountId && input.accountId !== row.subject_id) return "other_account"
  if (input.loginHint && (!input.subjectEmail || normEmail(input.loginHint) !== normEmail(input.subjectEmail))) return "hint"
  return null
}
