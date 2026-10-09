// osc-app (client-website SPEC §33): the logged-in site on portal.oliverstreetcreative.com. One table decides what each
// request on that host is. Pure, so the tests drive it. Middleware runs it FIRST, and only when APP_ORIGIN is set:
// staging and the public site never do.
//   forms   proxied, same path and query, to FORMS_ORIGIN: everything the "OSC - Forms" service answered on this host
//           before osc-app took it (the old portal, the hub and its doors, shoot days, invoicing, its own files), so
//           links already sent keep working
//   root    "/" → the client site
//   app     the logged-in site itself
//   public  anything else → 308 to the public site (https://oliverstreetcreative.com), same path and query

export type AppRoute = "forms" | "root" | "app" | "public"

const FORMS_EXACT = new Set(["/portal", "/hub", "/crew", "/sw.js", "/healthz", "/start-a-project"])
const FORMS_PREFIX = ["/portal/", "/hub/", "/hub-fonts/", "/day/", "/invoice/", "/crew/", "/static/"]
const APP_EXACT = new Set(["/client", "/login", "/magic", "/admin", "/favicon.ico"])
const APP_PREFIX = ["/client/", "/admin/", "/api/", "/calendar/", "/support/", "/client-logos/", "/_next/"]

export function appRoute(path: string): AppRoute {
  if (FORMS_EXACT.has(path) || FORMS_PREFIX.some((p) => path.startsWith(p))) return "forms"
  if (path === "/") return "root"
  if (APP_EXACT.has(path) || APP_PREFIX.some((p) => path.startsWith(p))) return "app"
  return "public"
}

/** An https origin from the environment ("https://host", no path), or null. */
export function originFrom(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim().replace(/\/+$/, "")
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

/** This deployment's own origin when it is osc-app (APP_ORIGIN), else null. The literal read keeps it visible to the
 *  middleware bundle. */
export const appOrigin = () => originFrom(process.env.APP_ORIGIN)
/** osc-app's own origins, canonical first: APP_ORIGIN, then its Railway name (RAILWAY_PUBLIC_DOMAIN), so it can be
 *  signed into and checked there before portal.* moves. Empty when this deployment isn't osc-app. */
export function appOrigins(): string[] {
  const app = appOrigin()
  if (!app) return []
  const railway = originFrom(process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
  return railway && railway !== app ? [app, railway] : [app]
}
/** Where the Forms service answers (FORMS_ORIGIN, its own Railway name), or null. */
export const formsOrigin = () => originFrom(process.env.FORMS_ORIGIN)
export const PUBLIC_SITE = "https://oliverstreetcreative.com"
