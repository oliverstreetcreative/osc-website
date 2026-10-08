import { NextResponse } from "next/server"
import { canWrite, getClientContext, ORG_COOKIE } from "@/lib/client/context"
import { isSecure, publicOrigin } from "@/lib/client/host"

export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const slug = String((await req.formData()).get("slug") ?? "")
  const res = NextResponse.redirect(`${publicOrigin(req)}/client`, 303)
  if (ctx.orgs.some((o) => o.slug === slug)) {
    res.cookies.set(ORG_COOKIE, slug, { path: "/", httpOnly: true, sameSite: "lax", secure: isSecure(req), maxAge: 60 * 60 * 24 * 365 })
  }
  return res
}

export const dynamic = "force-dynamic"
