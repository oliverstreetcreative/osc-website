import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { VILLAGE_COOKIE_NAME, verifyVillageCookie } from '@/app/village/lib'
import { IS_STAGING } from '@/lib/site-env'

const SESSION_COOKIE_NAME = 'osc_session'
const VIEW_AS_ALLOWED_WRITES = new Set([
  '/client/view-as/start',
  '/client/view-as/exit',
  '/client/signout',
  '/api/auth/logout',
  '/api/admin/impersonate/stop',
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
const IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-role',
  'x-user-is-staff',
  'x-impersonating',
  'x-impersonator-id',
  'x-impersonation-target-name',
]
const IMPERSONATION_COOKIE_NAME = 'osc_impersonating'
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
  if (pathname.startsWith('/api/publish')) return true
  if (pathname === '/api/estimate') return true
  // Client site: private calendar feeds authenticate by their own token.
  if (pathname.startsWith('/calendar/')) return true
  if (pathname.startsWith('/f/')) return true
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true
  return false
}

// On portal subdomains (client.*, crew.*) the site's marketing / and /casting etc.
// are not public — the portal dashboard lives at /. Only infra paths and the auth
// handshake should bypass session checks here.
function isPortalInfraPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true
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

/** A demo session that is no longer valid: sign it out (host-only cookie, plus the shared-domain copy if any). */
function endDemoSession(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = '?demo_ended=1'
  const res = NextResponse.redirect(url)
  res.headers.append('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim()
  if (domain) res.headers.append('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Domain=${domain}`)
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

async function verifySession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    )
    if (payload.purpose === 'magic_link') return null
    return {
      id: String(payload.id ?? ''),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? ''),
      is_staff: payload.is_staff === true,
      // The staging demo (SPEC §19): the token's fingerprint, checked against the CURRENT token on every request.
      demo: payload.demo === undefined ? undefined : String(payload.demo),
    }
  } catch {
    return null
  }
}

function setUserHeaders(res: NextResponse, user: { id: string; email: string; role: string; is_staff: boolean }) {
  res.headers.set('x-user-id', user.id)
  res.headers.set('x-user-email', user.email)
  res.headers.set('x-user-role', user.role)
  res.headers.set('x-user-is-staff', String(user.is_staff))
  return res
}

interface ImpersonationPayload {
  impersonator_person_id: string
  target_person_id: string
  target_role: string
  target_name: string
  target_email: string
}

async function applyImpersonation(
  req: NextRequest,
  res: NextResponse,
  realUser: { id: string; is_staff: boolean },
  pathname: string,
): Promise<NextResponse> {
  // Do not apply impersonation on the stop endpoint — it needs the real user context
  if (pathname === '/api/admin/impersonate/stop') {
    return res
  }

  const impToken = req.cookies.get(IMPERSONATION_COOKIE_NAME)?.value
  if (!impToken) return res

  // Real user must be staff to impersonate
  if (!realUser.is_staff) {
    // Silently clear the cookie — non-staff cannot impersonate
    res.cookies.set(IMPERSONATION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return res
  }

  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) return res

  try {
    const { payload } = await jwtVerify(
      impToken,
      new TextEncoder().encode(secret),
    )
    const imp = payload as unknown as ImpersonationPayload

    // Override user headers to reflect the impersonation target
    res.headers.set('x-user-id', imp.target_person_id)
    res.headers.set('x-user-email', imp.target_email)
    res.headers.set('x-user-role', imp.target_role)
    res.headers.set('x-user-is-staff', 'false')
    res.headers.set('x-impersonating', 'true')
    res.headers.set('x-impersonator-id', realUser.id)
    res.headers.set('x-impersonation-target-name', imp.target_name)
  } catch {
    // Expired or invalid — clear silently
    res.cookies.set(IMPERSONATION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
  }

  return res
}

function redirectToLogin(req: NextRequest): NextResponse {
  const subdomain = getSubdomain(req.headers.get('host') ?? '')
  const returnPath = req.nextUrl.pathname

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

  // The staging demo: valid only while it matches the current token; read-only everywhere (SPEC §19 v2).
  // /demo/<token> itself is exempt, so a NEW link replaces an old (rotated) demo session instead of bouncing to /login.
  if (req.cookies.get(SESSION_COOKIE_NAME)?.value && !pathMatches(req.nextUrl.pathname, '/demo')) {
    const session = await verifySession(req)
    if (session?.demo !== undefined) {
      const fingerprint = await demoFingerprintEdge()
      if (!fingerprint || session.demo !== fingerprint) return endDemoSession(req)
      if (!demoMayRequest(req)) return new NextResponse(null, { status: 404 })
    }
  }

  // Staff looking at a client's site is READ-ONLY, in BOTH staff modes: the
  // client site's "View as client" (cs_view) and the older admin impersonation
  // (osc_impersonating, which swaps the identity to the client). While either
  // cookie exists, refuse every write except the few that end the view or sign out.
  if (
    isWrite &&
    (req.cookies.get('cs_view')?.value || req.cookies.get(IMPERSONATION_COOKIE_NAME)?.value) &&
    !VIEW_AS_ALLOWED_WRITES.has(req.nextUrl.pathname)
  ) {
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
  if (isWrite && req.cookies.get(SESSION_COOKIE_NAME)?.value && !sameOrigin(req)) {
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
      const res = setUserHeaders(NextResponse.rewrite(url), user)
      return applyImpersonation(req, res, user, pathname)
    }

    const res = setUserHeaders(NextResponse.next(), user)
    return applyImpersonation(req, res, user, pathname)
  }

  // --- Subdomain: crew.* ---
  if (subdomain === 'crew') {
    if (isPortalInfraPath(pathname)) return NextResponse.next()

    const user = await verifySession(req)
    if (!user) return redirectToLogin(req)

    if (!pathMatches(pathname, '/crew') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = pathname === '/' ? '/crew' : `/crew${pathname}`
      const res = setUserHeaders(NextResponse.rewrite(url), user)
      return applyImpersonation(req, res, user, pathname)
    }

    const res = setUserHeaders(NextResponse.next(), user)
    return applyImpersonation(req, res, user, pathname)
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
      const res = setUserHeaders(NextResponse.next(), user)
      return applyImpersonation(req, res, user, pathname)
    }

    return NextResponse.next()
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
    pathMatches(pathname, '/api/events')

  if (!isProtected) return NextResponse.next()

  const user = await verifySession(req)
  if (!user) return redirectToLogin(req)

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

  const res = setUserHeaders(NextResponse.next(), user)
  return applyImpersonation(req, res, user, pathname)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
