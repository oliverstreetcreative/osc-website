import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { VILLAGE_COOKIE_NAME, verifyVillageCookie } from '@/app/village/lib'
import { IS_STAGING } from '@/lib/site-env'
import { scopeAllows, type Scope } from '@/lib/auth/paths'
import { edgeSession, type EdgeSession } from '@/lib/auth/session-rules'

// SPEC §27 P0 v2: `__Host-osc_session` wherever the site is served over https (no subdomain's domain-wide cookie can
// override it). The plain `osc_session` counts ONLY on localhost (built review: anywhere else a sibling subdomain could
// toss one at a signed-out visitor and sign them in as someone else).
const SESSION_COOKIE_SECURE = '__Host-osc_session'
const SESSION_COOKIE_PLAIN = 'osc_session'
const isLocalhost = (req: NextRequest) => ['localhost', '127.0.0.1'].includes(requestHost(req).split(':')[0])
const sessionCookie = (req: NextRequest) =>
  req.cookies.get(SESSION_COOKIE_SECURE)?.value ?? (isLocalhost(req) ? req.cookies.get(SESSION_COOKIE_PLAIN)?.value : undefined)
const PREVIEW_ALLOWED_WRITES = new Set(['/client/signout', '/client/view-as/exit'])
const VIEW_AS_ALLOWED_WRITES = new Set([
  '/client/view-as/start',
  '/client/view-as/exit',
  '/client/signout',
  '/client/account/revoke', // staff signing their OWN devices out
  '/api/auth/logout',
])

/** The host this request was made to (Railway's proxy sets x-forwarded-host). */
function requestHost(req: NextRequest): string {
  return (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase()
}

/** True when the request's Origin (or, failing that, Referer) is this same host. */
function sameOrigin(req: NextRequest): boolean {
  const host = requestHost(req)
  const from = req.headers.get('origin') ?? req.headers.get('referer')
  if (!from || from === 'null' || !host) return false
  try {
    return new URL(from).host.toLowerCase() === host
  } catch {
    return false
  }
}
// Identity headers are only ever set here (from a verified token); a browser's own copies are stripped. The legacy
// impersonation's names stay on the list so a forged one can never reach a handler.
const IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-role',
  'x-user-is-staff',
  'x-user-preview',
  'x-impersonating',
  'x-impersonator-id',
  'x-impersonation-target-name',
]
const LOGIN_HOST = process.env.LOGIN_HOST ?? 'login.oliverstreetcreative.com'

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/magic',
  '/casting',
  '/join-our-crew',
  '/locations',
  '/service-businesses',
  '/pricing',
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/work/')) return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/api/intake')) return true
  if (pathname === '/api/estimate') return true
  // Client site: private calendar feeds authenticate by their own token.
  if (pathname.startsWith('/calendar/')) return true
  // Script invites (client-website SPEC §14 v4 #10): the link's page and its tap work signed out; the token is the key.
  if (pathname.startsWith('/client/scripts/invite/')) return true
  if (pathname === '/api/scripts/invite/accept' || pathname === '/api/scripts/invite/renew') return true
  // "Trouble signing in?" (client-website SPEC §29 v2): no session by definition; the route checks its own origin.
  if (pathname === '/support/signin-trouble') return true
  if (pathname.startsWith('/f/')) return true
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true
  return false
}

// On portal subdomains (client.*, crew.*) the site's marketing / and /casting etc.
// are not public — the portal dashboard lives at /. Only infra paths and the auth
// handshake should bypass session checks here.
function isPortalInfraPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true
  // The page that redeems a sign-in link: links are minted on the host the person will use (crew.* for crew; SPEC
  // §26 v2), so it must load there before any session exists.
  if (pathname === '/magic') return true
  // "Trouble signing in?" (SPEC §29 v2) works before any session, on the portal subdomains too.
  if (pathname === '/support/signin-trouble') return true
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true
  return false
}

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

// ---------------------------------------------------------------------------
// The staging DEMO (client-website SPEC §19 v2). A demo session carries `demo: <fingerprint>` in its signed JWT,
// where the fingerprint is the first 16 hex of sha256(CLIENT_DEMO_TOKEN). It is honoured only on staging, only
// while the env var holds a long random token, and only while the fingerprint matches: rotate or unset the
// variable and every open demo session is signed out on its next request. A demo session may READ client pages
// and public pages, and may sign out; everything else answers 404. (lib/client/demo.ts is the Node-side twin.)
// ---------------------------------------------------------------------------
const DEMO_TOKEN_MIN = 32

async function demoFingerprintEdge(): Promise<string | null> {
  const t = (process.env.CLIENT_DEMO_TOKEN ?? '').trim()
  if (!IS_STAGING || t.length < DEMO_TOKEN_MIN || !/^[A-Za-z0-9_-]+$/.test(t)) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

function demoMayRequest(req: NextRequest): boolean {
  const p = req.nextUrl.pathname
  if (req.method === 'POST' && p === '/client/signout') return true
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (pathMatches(p, '/client/view-as') || pathMatches(p, '/crew') || pathMatches(p, '/admin') || p.startsWith('/api/')) {
    return false
  }
  return true
}

/** A demo session that is no longer valid: sign it out (both cookie names) with the "demo ended" note. */
function endDemoSession(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = '?demo_ended=1'
  const res = NextResponse.redirect(url)
  res.headers.append('Set-Cookie', `${SESSION_COOKIE_SECURE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
  res.headers.append('Set-Cookie', `${SESSION_COOKIE_PLAIN}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  return res
}

function getSubdomain(host: string): 'login' | 'client' | 'crew' | 'village' | null {
  const h = host.split(':')[0].toLowerCase()

  if (h.startsWith('client.')) return 'client'
  if (h.startsWith('crew.')) return 'crew'
  if (h.startsWith('login.')) return 'login'
  if (h.startsWith('village.')) return 'village'

  return null
}

/** The session token's verified claims, or null. Signature and expiry only: the Edge has no database, so the ROW is
 *  checked on the server (lib/auth/require-session.ts). A token without a `sid` is no session (SPEC §27 P0 v2). */
async function tokenClaims(req: NextRequest): Promise<Record<string, unknown> | null> {
  const token = sessionCookie(req)
  const secret = process.env.SESSION_JWT_SECRET
  if (!token || !secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

async function verifySession(req: NextRequest): Promise<EdgeSession | null> {
  return edgeSession(await tokenClaims(req))
}

function setUserHeaders(res: NextResponse, user: EdgeSession) {
  // A script invite's session is never "the person" to a handler: no identity headers at all.
  if (user.scope) return res
  res.headers.set('x-user-id', user.id)
  res.headers.set('x-user-email', user.email)
  res.headers.set('x-user-role', user.role)
  res.headers.set('x-user-is-staff', String(user.is_staff))
  if (user.preview) res.headers.set('x-user-preview', 'true')
  return res
}

/** A script invite's session asking for anything but its own script: a real sign-in, keeping where they were going. */
function scopedElsewhere(req: NextRequest, scope: Scope, appPath: string): NextResponse | null {
  if (scopeAllows(scope, appPath)) return null
  if (appPath.startsWith('/api/')) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = `?redirect=${encodeURIComponent(appPath)}`
  return NextResponse.redirect(url)
}

function redirectToLogin(req: NextRequest): NextResponse {
  const subdomain = getSubdomain(req.headers.get('host') ?? '')
  const returnPath = req.nextUrl.pathname

  // Crew sign in on crew.* itself (SPEC §27 P0 v2: the device cookie lands where crew links point).
  if (subdomain === 'crew') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?redirect=${encodeURIComponent(pathMatches(returnPath, '/crew') ? returnPath : `/crew${returnPath === '/' ? '' : returnPath}`)}`
    return NextResponse.redirect(url)
  }
  if (subdomain && subdomain !== 'login') {
    const url = new URL(`https://${LOGIN_HOST}/login`)
    url.searchParams.set('redirect', req.nextUrl.href)
    return NextResponse.redirect(url)
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = `?redirect=${encodeURIComponent(returnPath)}`
  return NextResponse.redirect(url)
}

// On the STAGING environment every response carries a noindex header so no
// draft ever ends up in a search index next to the real site. Production is
// untouched (IS_STAGING is false there). See app/robots.ts for the robots.txt half.
export async function middleware(req: NextRequest) {
  if (IS_STAGING && req.nextUrl.pathname === '/robots.txt') {
    // Staging's robots.txt closes the door. Production keeps /public/robots.txt.
    return new NextResponse('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)


  // The staging demo: valid only while it matches the current token; read-only everywhere (SPEC §19 v2). A demo token
  // from before the session rows (no `sid`) ends here too, with the "demo ended" note (SPEC §27 P0 v2).
  // /demo/<token> itself is exempt, so a NEW link replaces an old (rotated) demo session instead of bouncing to /login.
  if (sessionCookie(req) && !pathMatches(req.nextUrl.pathname, '/demo')) {
    const claims = await tokenClaims(req)
    if (claims && claims.demo !== undefined) {
      const fingerprint = await demoFingerprintEdge()
      if (!fingerprint || String(claims.demo) !== fingerprint || !claims.sid) return endDemoSession(req)
      if (!demoMayRequest(req)) return new NextResponse(null, { status: 404 })
    }
    // A staging preview sign-in (the screenshot harness) may read everything and change nothing but its own sign-out.
    if (claims?.preview === true && isWrite && !PREVIEW_ALLOWED_WRITES.has(req.nextUrl.pathname) && !req.nextUrl.pathname.startsWith('/api/auth/')) {
      return new NextResponse('Read-only: this is a preview sign-in.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
  }

  // Staff looking at a client's site is READ-ONLY: while the "View as client" cookie (cs_view) exists, refuse every
  // write except the few that end the view or sign out, and signing in itself (a leftover cs_view must never block
  // the way back in; built review). (The older admin impersonation is retired, SPEC §27 P0 v2.)
  const signingIn = req.nextUrl.pathname.startsWith('/api/auth/') || req.nextUrl.pathname === '/support/signin-trouble'
  if (isWrite && req.cookies.get('cs_view')?.value && !signingIn && !VIEW_AS_ALLOWED_WRITES.has(req.nextUrl.pathname)) {
    return new NextResponse('Read-only: you are viewing the site as a client. Exit the view to make changes.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  // CSRF guard: a write that rides on a session cookie must come from a page on
  // this same host. Browsers send Origin on form posts and fetches; another
  // oliverstreetcreative.com subdomain (Review, the hub, the blog) counts as
  // same-SITE for cookies, so SameSite alone can't stop it, but it is never the
  // same ORIGIN. Writes without a session cookie (public intake forms, the
  // sign-in request) aren't affected.
  if (isWrite && sessionCookie(req) && !sameOrigin(req)) {
    return new NextResponse('This request came from another site and was refused.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const res = await route(req)
  // Identity headers are ONLY ever set by this middleware. A browser could
  // send its own x-user-* headers, so for every request that continues to a
  // page or handler, forward a copy of the request headers with those removed
  // (Next's request-header override). Values set via setUserHeaders() are
  // applied on top of this by Next, so real sessions still work.
  if (res.headers.get('x-middleware-next') || res.headers.get('x-middleware-rewrite')) {
    const keys: string[] = []
    req.headers.forEach((value, key) => {
      if (IDENTITY_HEADERS.includes(key.toLowerCase())) return
      keys.push(key)
      res.headers.set(`x-middleware-request-${key}`, value)
    })
    res.headers.set('x-middleware-override-headers', keys.join(','))
  }
  if (IS_STAGING) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  // The client site is never framed by another page (SPEC §24 built review): Accept, Approve and Pay are one tap, and
  // a sibling subdomain counts as same-SITE for the session cookie, so it could frame a page and steer that tap.
  // Same-origin frames (the proposal PDF) still work.
  if (req.nextUrl.pathname.startsWith('/client') || getSubdomain(req.headers.get('host') ?? '') === 'client') {
    res.headers.set('X-Frame-Options', 'SAMEORIGIN')
    res.headers.set('Content-Security-Policy', "frame-ancestors 'self'")
  }
  return res
}

async function route(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host') ?? ''
  const subdomain = getSubdomain(host)

  // --- Subdomain: client.* ---
  if (subdomain === 'client') {
    if (isPortalInfraPath(pathname)) return NextResponse.next()

    const user = await verifySession(req)
    if (!user) return redirectToLogin(req)

    // Rewrite root to /client prefix so app/client routes serve content
    if (!pathMatches(pathname, '/client') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = pathname === '/' ? '/client' : `/client${pathname}`
      if (user.scope) {
        const away = scopedElsewhere(req, user.scope, url.pathname)
        if (away) return away
      }
      return setUserHeaders(NextResponse.rewrite(url), user)
    }

    if (user.scope) {
      const away = scopedElsewhere(req, user.scope, pathname)
      if (away) return away
    }
    return setUserHeaders(NextResponse.next(), user)
  }

  // --- Subdomain: crew.* ---
  if (subdomain === 'crew') {
    if (isPortalInfraPath(pathname) || pathname === '/login') return NextResponse.next()

    const user = await verifySession(req)
    if (!user || user.scope) return redirectToLogin(req)

    if (!pathMatches(pathname, '/crew') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = pathname === '/' ? '/crew' : `/crew${pathname}`
      return setUserHeaders(NextResponse.rewrite(url), user)
    }

    return setUserHeaders(NextResponse.next(), user)
  }

  // --- Subdomain: village.* ---
  // Password-gated live-stream viewer. Rewrites all paths onto /village so
  // the subdomain root serves app/village/page.tsx. Requires a valid
  // village_access cookie; /login and /api/unlock are exempt so the password
  // form can render and post.
  if (subdomain === 'village') {
    if (isPortalInfraPath(pathname)) return NextResponse.next()

    const targetPath = pathMatches(pathname, '/village')
      ? pathname
      : pathname === '/'
        ? '/village'
        : `/village${pathname}`

    const isLogin = pathMatches(targetPath, '/village/login')
    const isUnlock = pathMatches(targetPath, '/village/api/unlock')

    if (!isLogin && !isUnlock) {
      const token = req.cookies.get(VILLAGE_COOKIE_NAME)?.value
      const ok = await verifyVillageCookie(token)
      if (!ok) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }

    if (targetPath !== pathname) {
      const url = req.nextUrl.clone()
      url.pathname = targetPath
      return NextResponse.rewrite(url)
    }

    return NextResponse.next()
  }

  // --- Subdomain: login.* ---
  if (subdomain === 'login') {
    if (isPublicPath(pathname)) return NextResponse.next()

    if (pathMatches(pathname, '/admin')) {
      const user = await verifySession(req)
      if (!user || (!user.is_staff && user.role !== 'STAFF')) {
        return new NextResponse(null, { status: 404 })
      }
      return setUserHeaders(NextResponse.next(), user)
    }

    return protectedRoute(req, pathname)
  }

  // --- No subdomain (marketing site / direct access) ---

  // Canonicalize the village live stream to its dedicated subdomain — one
  // URL for viewers to share. 308 preserves the HTTP method, so form POSTs
  // to /village/api/unlock survive the redirect. The /village prefix is
  // stripped since the subdomain's middleware rewrites root paths onto it.
  if (pathMatches(pathname, '/village')) {
    const url = req.nextUrl.clone()
    url.host = 'village.oliverstreetcreative.com'
    url.protocol = 'https:'
    url.port = ''
    url.pathname = pathname.replace(/^\/village/, '') || '/'
    return NextResponse.redirect(url, 308)
  }

  if (isPublicPath(pathname)) return NextResponse.next()
  return protectedRoute(req, pathname)
}

/** The apex's (and login.*'s) rules for everything that isn't public: a session for the protected prefixes, a script
 *  invite's session only on its own script, staff for /admin, and no Bible-era APIs for clients. */
async function protectedRoute(req: NextRequest, pathname: string): Promise<NextResponse> {
  // The shoot-day hub reads a script server to server with a key in a header, no session (client-website SPEC §14
  // v4 #9); the route checks the key. Nothing else under /api/scripts is open.
  if (/^\/api\/scripts\/[0-9a-f-]{36}\/render$/i.test(pathname) && req.method === 'GET') return NextResponse.next()

  // Protected prefixes use exact-or-trailing-slash matching so that sibling
  // public assets like /client-logos/*.png are NOT auth-gated by accident.
  const isProtected =
    pathMatches(pathname, '/client') ||
    pathMatches(pathname, '/crew') ||
    pathMatches(pathname, '/admin') ||
    pathname.startsWith('/api/upload') ||
    pathMatches(pathname, '/api/admin') ||
    pathMatches(pathname, '/api/portal') ||
    pathMatches(pathname, '/api/crew') ||
    pathMatches(pathname, '/api/events') ||
    pathMatches(pathname, '/api/scripts')

  if (!isProtected) return NextResponse.next()

  const user = await verifySession(req)
  if (!user) {
    // the script editor's feed and saves are fetches: a plain 401 it can act on, never the login page's HTML
    if (pathMatches(pathname, '/api/scripts')) {
      return NextResponse.json({ error: 'Sign in' }, { status: 401 })
    }
    return redirectToLogin(req)
  }
  // A script invite's session reaches its own script and nothing else (SPEC §27 P0 v2).
  if (user.scope) {
    const away = scopedElsewhere(req, user.scope, pathname)
    if (away) return away
  }

  if (pathMatches(pathname, '/admin') && !user.is_staff && user.role !== 'STAFF') {
    return new NextResponse(null, { status: 404 })
  }

  // Legacy portal APIs (Bible era) aren't part of the client site; clients get 404
  // until they're rebuilt behind the publish gate. Crew/staff keep their uses.
  if (
    user.role === 'CLIENT' &&
    (pathMatches(pathname, '/api/portal') || pathname.startsWith('/api/upload') || pathMatches(pathname, '/api/events'))
  ) {
    return new NextResponse(null, { status: 404 })
  }

  return setUserHeaders(NextResponse.next(), user)
}

export const config = {
  // SPEC §31 v2 (built review): the brand-asset upload never runs through middleware. Next 14 holds a request's whole
  // body (twice) before middleware can answer, so a guard here couldn't stop a huge file; the upload route does its own
  // checks (same origin, read-only and preview sessions refused, the size refused before the body is read).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|client/start/upload$|start/upload$).*)'],
}
