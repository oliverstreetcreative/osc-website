// Which host a sign-in link points at (SPEC §26 v2, cut-over design review). Session cookies are HOST-ONLY (10/3), so
// a person must sign in on the very host they will use, or the cookie never reaches it:
//   - production: clients on the apex (where /client lives), crew on crew.*, staff where they asked from (login.* for
//     the admin, the apex for View as client);
//   - anywhere else (staging, local): the host they asked from, as before.
// Pure, so it's tested without a server.
export const APEX = "https://oliverstreetcreative.com"
export const CREW = "https://crew.oliverstreetcreative.com"
/** The hosts this app serves sign-in on, as constants (SPEC §27 P0 v2 #8): a forged Host or X-Forwarded-Host can never
 *  send a real sign-in link to blog.*, review.* or a dangling subdomain. */
export const SIGNIN_HOSTS = new Set([APEX, CREW, "https://client.oliverstreetcreative.com", "https://login.oliverstreetcreative.com"])

export function magicLinkOrigin(opts: {
  isProduction: boolean
  requestOrigin: string
  role: string | null | undefined
  isStaff: boolean
  /** osc-app (SPEC §33): its own origins, canonical first (portal.*, then its Railway name). Everyone signs in there. */
  appOrigins?: string[]
}): string {
  if (!opts.isProduction) return opts.requestOrigin
  if (opts.appOrigins?.length) return opts.appOrigins.includes(opts.requestOrigin) ? opts.requestOrigin : opts.appOrigins[0]
  if (opts.isStaff || opts.role === "STAFF") return SIGNIN_HOSTS.has(opts.requestOrigin) ? opts.requestOrigin : APEX
  if (opts.role === "CREW") return CREW
  return APEX
}
