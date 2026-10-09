// The private per-person calendar feed: webcal://<host>/calendar/<token>.ics
// The token IS the credential (unguessable, reset from /client/calendar).
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { eventsForPerson, toICS } from "@/lib/client/calendar"
import { publicOrigin } from "@/lib/client/host"
import { mayViewClientSite } from "@/lib/auth/signin-only"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.ics$/, "")
  if (!/^[A-Za-z0-9_-]{24,}$/.test(token)) return new NextResponse(null, { status: 404 })
  const person = await db.person.findUnique({ where: { calendar_token: token } })
  // (Sam's test phase, CLIENT_SIGNIN_ONLY: a feed for staff and the listed addresses only.)
  if (!person || !person.portal_allowed || !mayViewClientSite(person)) return new NextResponse(null, { status: 404 })
  const events = await eventsForPerson(person.id, person.is_staff)
  return new NextResponse(toICS(events, publicOrigin(req)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  })
}
