// Sam 10/8 ~19:40–20:20: while he tests the client site live he is its only user. No client is invited or emailed, and
// real client data shows to no one but signed-in staff (and the test client he plays). The switch, read on every call:
//   CLIENT_SIGNIN_ONLY = a comma-separated list of CLIENT addresses that may sign in (internal@ for his test).
// While it is SET (even listing nobody: it fails closed, 20:10 review):
//   - every other CLIENT person is refused at the door (the usual uniform answer, nothing sent); their links and codes
//     don't redeem; a session they already hold reads as signed out;
//   - the client pages, files and calendar feeds serve no one but staff and the listed addresses (a CREW-role contact in
//     a client's book signs in for the crew portal, and still sees no client's pages);
//   - no client mail goes anywhere but OSC addresses and the list, and nothing is kept to send later.
// Staff and crew can always sign in. Unset = the site as built. (client-website SPEC §26 v3, §33)

/** The listed client addresses while the test phase is on (possibly none), or null when it's off (unset). */
export function signInOnly(raw: string | undefined = process.env.CLIENT_SIGNIN_ONLY): Set<string> | null {
  if (raw === undefined) return null
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))
}

export type Who = { email: string; role: string; is_staff: boolean }

const listed = (only: Set<string>, email: string) => only.has(email.trim().toLowerCase())
const isStaff = (p: { role?: string; is_staff: boolean }) => p.is_staff || p.role === "STAFF"

/** May this person sign in right now? Staff and crew always; a client only if listed (test phase). */
export function mayUseSite(p: Who, only: Set<string> | null = signInOnly()): boolean {
  if (!only) return true
  if (isStaff(p) || p.role === "CREW") return true
  return listed(only, p.email)
}

/** May this person see the CLIENT site (pages, files, calendar feed) right now? Staff (View as client) always; anyone
 *  else only if listed (test phase), whatever their role. */
export function mayViewClientSite(p: { email: string; role?: string; is_staff: boolean }, only: Set<string> | null = signInOnly()): boolean {
  if (!only || isStaff(p)) return true
  return listed(only, p.email)
}

/** May client-facing mail (a script invite, a notice) go to this address right now? OSC addresses and the list only,
 *  while the test phase is on. */
export function mayMailClient(email: string, only: Set<string> | null = signInOnly()): boolean {
  if (!only) return true
  const e = email.trim().toLowerCase()
  return e.endsWith("@oliverstreetcreative.com") || only.has(e)
}
