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
])
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
  // View as client (OSC staff) is READ-ONLY: while the cs_view cookie exists,
  // refuse every write except the few that end the view or sign out.
  if (
    req.cookies.get('cs_view')?.value &&
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    !VIEW_AS_ALLOWED_WRITES.has(req.nextUrl.pathname)
  ) {
    return new NextResponse('Read-only: you are viewing the site as a client. Exit the view to make changes.', {
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
