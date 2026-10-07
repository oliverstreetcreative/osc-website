// The owner's gate for the deputies page's actions (SPEC §27 P1 v2 #8). Server only.
import { sessionUser } from "@/lib/auth/require-session"
import { normEmail, stepUpFresh } from "./rules"
import { ownerEmail } from "./subjects"

/** The owner, signed in as a person, with a sign-in that proved the mailbox in the last 10 minutes; else why not. */
export async function ownerStepUp(): Promise<{ ok: true; owner: string } | { ok: false; why: "not_owner" | "stale" }> {
  const s = await sessionUser()
  const owner = ownerEmail()
  if (!s || s.scope || s.kind !== "person" || !owner || normEmail(s.person.email) !== owner) return { ok: false, why: "not_owner" }
  if (!stepUpFresh({ created_at: s.createdAt, amr: s.amr }, new Date())) return { ok: false, why: "stale" }
  return { ok: true, owner }
}
