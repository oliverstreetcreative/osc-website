import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE_NAME = 'osc_session'
const LOGIN_HOST = process.env.LOGIN_HOST ?? 'login.oliverstreetcreative.com'

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/magic',
  '/casting',
  '/join-our-crew',
  '/locations',
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/api/intake')) return true
  if (pathname.startsWith('/api/publish')) return true
  if (pathname.startsWith('/f/')) return true
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true
  return false
}

function getSubdomain(host: string): 'login' | 'client' | 'crew' | null {
  const h = host.split(':')[0].toLowerCase()

  if (h.startsWith('client.')) return 'client'
  if (h.startsWith('crew.')) return 'crew'
  if (h.startsWith('login.')) return 'login'

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host') ?? ''
  const subdomain = getSubdomain(host)

  // --- Subdomain: client.* ---
  if (subdomain === 'client') {
    if (isPublicPath(pathname)) return NextResponse.next()

    const user = await verifySession(req)
    if (!user) return redirectToLogin(req)

    // Rewrite root to /client prefix so app/client routes serve content
    if (!pathname.startsWith('/client') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = `/client${pathname}`
      const res = NextResponse.rewrite(url)
      return setUserHeaders(res, user)
    }

    const res = NextResponse.next()
    return setUserHeaders(res, user)
  }

  // --- Subdomain: crew.* ---
  if (subdomain === 'crew') {
    if (isPublicPath(pathname)) return NextResponse.next()

    const user = await verifySession(req)
    if (!user) return redirectToLogin(req)

    if (!pathname.startsWith('/crew') && !pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone()
      url.pathname = `/crew${pathname}`
      const res = NextResponse.rewrite(url)
      return setUserHeaders(res, user)
    }

    const res = NextResponse.next()
    return setUserHeaders(res, user)
  }

  // --- Subdomain: login.* ---
  if (subdomain === 'login') {
    if (isPublicPath(pathname)) return NextResponse.next()

    if (pathname.startsWith('/admin')) {
      const user = await verifySession(req)
      if (!user || (!user.is_staff && user.role !== 'STAFF')) {
        return new NextResponse(null, { status: 404 })
      }
      const res = NextResponse.next()
      return setUserHeaders(res, user)
    }

    return NextResponse.next()
  }

  // --- No subdomain (marketing site / direct access) ---
  if (isPublicPath(pathname)) return NextResponse.next()

  const isProtected =
    pathname.startsWith('/client') ||
    pathname.startsWith('/crew') ||
    pathname.startsWith('/admin')

  if (!isProtected) return NextResponse.next()

  const user = await verifySession(req)
  if (!user) return redirectToLogin(req)

  if (pathname.startsWith('/admin') && !user.is_staff && user.role !== 'STAFF') {
    return new NextResponse(null, { status: 404 })
  }

  const res = NextResponse.next()
  return setUserHeaders(res, user)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
