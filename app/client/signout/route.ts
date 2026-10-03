import { NextRequest, NextResponse } from "next/server"
import { cookieDomainFor, isSecure, publicOrigin } from "@/lib/client/host"

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(`${publicOrigin(req)}/login?signed_out=1`, 303)
  for (const name of ["osc_session", "osc_impersonating"]) {
    res.cookies.set(name, "", { domain: cookieDomainFor(req), path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: isSecure(req) })
  }
  return res
}

export const dynamic = "force-dynamic"
