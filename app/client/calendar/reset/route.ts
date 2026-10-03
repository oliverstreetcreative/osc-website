import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  await db.person.update({ where: { id: ctx.user.id }, data: { calendar_token: randomBytes(24).toString("base64url") } })
  return NextResponse.redirect(new URL("/client/calendar", req.url), 303)
}

export const dynamic = "force-dynamic"
