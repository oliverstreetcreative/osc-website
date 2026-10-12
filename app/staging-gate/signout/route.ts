import { NextRequest, NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { sameOrigin } from "@/lib/support/http"
import { publicOrigin, isSecure } from "@/lib/client/host"
import { gateCookieExpirations } from "@/lib/staging/gate"
export const dynamic = "force-dynamic"
export async function POST(req: NextRequest) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 })
  const origin = publicOrigin(req)
  const res = NextResponse.redirect(`${origin}/staging-gate`, 303)
  for (const value of gateCookieExpirations(new URL(origin).hostname, isSecure(req))) res.headers.append("set-cookie", value)
  res.headers.set("cache-control", "no-store")
  return res
}
