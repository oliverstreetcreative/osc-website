// The sign-in bridge's choice (SPEC §27 P1 v2 #6): what `/id/sign-in/<uid>` does, given who is signed in at the apex
// and what the surface asked for. Pure: the page renders the answer, P0's front door does any sign-in (link or code,
// landing back here), and the glue finishes the interaction with `continue.login`.
import type { IdpLogin } from "./claims"
import { normEmail } from "./rules"

export type BridgeScreen =
  /** Finish now, as the person signed in at the apex (their row's own time and proof). */
  | { kind: "continue"; login: IdpLogin }
  /** login_hint names someone else: "Continue as Dana, or sign in as someone else?" (review SHOULD-FIX 9). */
  | { kind: "choose"; current: { name: string; email: string }; hint: string }
  /** Ask for a sign-in through the front door. `fresh`: someone IS signed in, but the surface wants new proof. */
  | { kind: "sign_in"; email: string | null; codeFirst: boolean; fresh: boolean }

export function bridgeScreen(input: {
  /** The apex row, already checked live, admitted and IdP-grade by `loginNeeded`; null when there isn't one. */
  live: { login: IdpLogin; email: string; name: string } | null
  loginHint: string | null
  /**
   * The sign-in must be at least this new (epoch seconds), or null. The glue sets it from `prompt=login` (when this
   * interaction began) and `max_age` (now minus max_age), whichever is later.
   */
  freshSince: number | null
  /** `osc_code_first=1`: an app in its own browser, where a link from mail would open elsewhere. */
  codeFirst: boolean
  /** The person's answer on the "choose" screen, once they've given one. */
  choice: "continue" | "switch" | null
}): BridgeScreen {
  const { live, codeFirst } = input
  const hint = input.loginHint ? normEmail(input.loginHint) : null
  if (!live) return { kind: "sign_in", email: hint, codeFirst, fresh: false }
  if (input.freshSince !== null && live.login.ts < input.freshSince) {
    return { kind: "sign_in", email: hint ?? normEmail(live.email), codeFirst, fresh: true }
  }
  if (hint && hint !== normEmail(live.email)) {
    if (input.choice === "continue") return { kind: "continue", login: live.login }
    if (input.choice === "switch") return { kind: "sign_in", email: hint, codeFirst, fresh: false }
    return { kind: "choose", current: { name: live.name, email: normEmail(live.email) }, hint }
  }
  return { kind: "continue", login: live.login }
}
