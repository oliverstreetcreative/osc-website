import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { publicOrigin } from "@/lib/client/host"

export async function POST(req: Request) {
  const ctx = await getClientContext()
  // Staff looking at a client's site never change the client's calendar link.
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  await db.person.update({ where: { id: ctx.user.id }, data: { calendar_token: randomBytes(24).toString("base64url") } })
  return NextResponse.redirect(`${publicOrigin(req)}/client/calendar`, 303)
}

export const dynamic = "force-dynamic"
