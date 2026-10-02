import { NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { DESK_COOKIE, deskKeyOk } from "@/lib/estimator/desk-auth"

// GET /api/quote-desk/unlock?key=... - trade the desk key (env QUOTE_DESK_KEY)
// for an httpOnly cookie, then go to the desk. Wrong key = 404, nothing set.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")
  if (!IS_STAGING || !deskKeyOk(key)) return new NextResponse(null, { status: 404 })
  const res = NextResponse.redirect(new URL("/quote-desk", url))
  res.cookies.set(DESK_COOKIE, key!, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 })
  return res
}
