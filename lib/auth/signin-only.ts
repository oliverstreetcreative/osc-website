// Sam 10/8 ~19:40–19:47: while he tests the client site on production he is its only user. No client is invited or
// emailed, and real client data shows to no one but signed-in staff (and the test client he plays). The switch, read
// on every call:
//   CLIENT_SIGNIN_ONLY = a comma-separated list of CLIENT addresses that may sign in (internal@ for his test).
// While it is set, every other CLIENT person is refused at the door (the usual uniform answer, nothing sent), their
// links and codes don't redeem, a session they already hold reads as signed out, and no client mail goes anywhere but
// OSC addresses and the list. Staff and crew are never affected. Unset = the site as built. (client-website SPEC §26 v3)

/** The listed client addresses while the test phase is on, or null when it's off. */
export function signInOnly(raw: string | undefined = process.env.CLIENT_SIGNIN_ONLY): Set<string> | null {
  const list = (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.length ? new Set(list) : null
}

export type Who = { email: string; role: string; is_staff: boolean }

/** May this person sign in and use the site right now? Staff and crew always; a client only if listed (test phase). */
export function mayUseSite(p: Who, only: Set<string> | null = signInOnly()): boolean {
  if (!only) return true
  if (p.is_staff || p.role === "STAFF" || p.role === "CREW") return true
  return only.has(p.email.trim().toLowerCase())
}

/** May client-facing mail (a script invite, a notice) go to this address right now? OSC addresses and the list only,
 *  while the test phase is on. */
export function mayMailClient(email: string, only: Set<string> | null = signInOnly()): boolean {
  if (!only) return true
  const e = email.trim().toLowerCase()
  return e.endsWith("@oliverstreetcreative.com") || only.has(e)
}
