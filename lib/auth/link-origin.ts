// Which host a sign-in link points at (SPEC §26 v2, cut-over design review). Session cookies are HOST-ONLY (10/3), so
// a person must sign in on the very host they will use, or the cookie never reaches it:
//   - production: clients on the apex (where /client lives), crew on crew.*, staff where they asked from (login.* for
//     the admin, the apex for View as client);
//   - anywhere else (staging, local): the host they asked from, as before.
// Pure, so it's tested without a server.
export const APEX = "https://oliverstreetcreative.com"
export const CREW = "https://crew.oliverstreetcreative.com"

export function magicLinkOrigin(opts: { isProduction: boolean; requestOrigin: string; role: string | null | undefined; isStaff: boolean }): string {
  if (!opts.isProduction) return opts.requestOrigin
  if (opts.isStaff || opts.role === "STAFF") return opts.requestOrigin
  if (opts.role === "CREW") return CREW
  return APEX
}
