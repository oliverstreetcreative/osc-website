import { NextResponse } from "next/server"
import { getPortalUser } from "@/lib/portal-auth"
import { VIEW_COOKIE } from "@/lib/client/context"
import { logViewAs } from "@/lib/client/view-as"
import { cookieDomainFor, isSecure, publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const user = await getPortalUser()
  if (user?.is_staff) await logViewAs("view_as_exit", user, null, req)
  const res = NextResponse.redirect(`${publicOrigin(req)}/client/view-as`, 303)
  res.cookies.set(VIEW_COOKIE, "", { domain: cookieDomainFor(req), path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: isSecure(req) })
  return res
}
