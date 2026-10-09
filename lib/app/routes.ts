// osc-app (client-website SPEC §33): the logged-in site on portal.oliverstreetcreative.com. One table decides what each
// request on that host is. Pure, so the tests drive it. Middleware runs it FIRST, and only when APP_ORIGIN is set:
// staging and the public site never do.
//   forms   proxied, same path and query, to FORMS_ORIGIN: everything the "OSC - Forms" service answered on this host
//           before osc-app took it (the old portal, the hub and its doors, shoot days, invoicing, its own files), so
//           links already sent keep working
//   root    "/" → the client site
//   app     the logged-in site itself: its pages and ONLY the APIs they call (v2: auth, scripts, admin, health)
//   public  anything else → 308 to the public site (https://oliverstreetcreative.com), same path and query; that
//           includes the public site's own APIs (intake, estimate, quote desk), which never run here

export type AppRoute = "forms" | "root" | "app" | "public"

const FORMS_EXACT = new Set(["/portal", "/hub", "/crew", "/sw.js", "/healthz", "/start-a-project"])
const FORMS_PREFIX = ["/portal/", "/hub/", "/hub-fonts/", "/day/", "/invoice/", "/crew/", "/static/"]
const APP_EXACT = new Set(["/client", "/login", "/magic", "/admin", "/favicon.ico", "/api/health"])
const APP_PREFIX = ["/client/", "/admin/", "/api/auth/", "/api/scripts/", "/api/admin/", "/calendar/", "/support/",
  "/client-logos/", "/_next/"]

export function appRoute(path: string): AppRoute {
  if (FORMS_EXACT.has(path) || FORMS_PREFIX.some((p) => path.startsWith(p))) return "forms"
  if (path === "/") return "root"
  if (APP_EXACT.has(path) || APP_PREFIX.some((p) => path.startsWith(p))) return "app"
  return "public"
}

/** The largest request osc-app passes on to Forms, by path. Next holds a proxied body in memory, so anything bigger is
 *  refused before it's read (v2 review #4/#6): the old portal's own limit (a 100 MB upload, plus the form around it);
 *  everywhere else 30 MB (an invoice carries at most two 12 MB files; a hub tick is bytes). */
export function formsMaxBody(path: string): number {
  return path === "/portal" || path.startsWith("/portal/") ? 105 * 1024 * 1024 : 30 * 1024 * 1024
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

/** Forms' own address: its Railway name (`*.up.railway.app`), never one of our names. hub.* and forms.* will move to
 *  this app one day, and a proxy pointed at them would then call itself (v2 review #9). `localhost` is allowed for the
 *  local proxy tests only; nothing listens there on Railway. */
export function formsOriginFrom(raw: string | undefined | null): string | null {
  const o = originFrom(raw)
  if (!o) return null
  const host = new URL(o).hostname
  return host.endsWith(".up.railway.app") || host === "localhost" ? o : null
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
export const formsOrigin = () => formsOriginFrom(process.env.FORMS_ORIGIN)
export const PUBLIC_SITE = "https://oliverstreetcreative.com"

/** Why osc-app must not start, or null. Checked at boot (lib/client/boot.ts): a typo'd APP_ORIGIN would quietly serve
 *  the whole public site here, and a bad FORMS_ORIGIN would break every crew link, so the deploy fails instead and
 *  Railway keeps the last good one. */
export function appConfigProblem(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.APP_ORIGIN?.trim()
  if (!raw) return null
  if (!originFrom(raw)) return "APP_ORIGIN isn't a plain https origin"
  if (!formsOriginFrom(env.FORMS_ORIGIN)) return "FORMS_ORIGIN must be the Forms service's own https://*.up.railway.app name"
  return null
}
