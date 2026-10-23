import { NextResponse } from "next/server"
import { getPortalUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { VIEW_COOKIE } from "@/lib/client/context"
import { mintViewCookie, logViewAs, VIEW_TTL_SECONDS } from "@/lib/client/view-as"
import { cookieDomainFor, isSecure, publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const user = await getPortalUser()
  if (!user?.is_staff) return new NextResponse(null, { status: 404 })
  const slug = String((await req.formData()).get("slug") ?? "")
  const org = await db.organization.findFirst({ where: { slug, hidden: false }, select: { slug: true, name: true } })
  if (!org) return NextResponse.redirect(`${publicOrigin(req)}/client/view-as`, 303)
  await logViewAs("view_as_start", user, org, req)
  const res = NextResponse.redirect(`${publicOrigin(req)}/client`, 303)
  res.cookies.set(VIEW_COOKIE, await mintViewCookie(user.id, org.slug), {
    domain: cookieDomainFor(req),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    maxAge: VIEW_TTL_SECONDS,
  })
  return res
}
