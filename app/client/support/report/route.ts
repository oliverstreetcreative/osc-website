// POST /client/support/report: "Something's wrong?" from someone signed in (SPEC §29 v2). Under /client so the
// middleware gives it the session, the same-origin (CSRF) check, the demo's read-only block and View-as's read-only
// block. The body is untrusted: lib/support/clean.ts caps, redacts and enums everything it keeps.
import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { clientIp } from "@/lib/client/ip"
import { isPreviewSession, sessionUser } from "@/lib/auth/require-session"
import { MAX_BODY, createTicket } from "@/lib/support/store"
import { mirrorTickets } from "@/lib/support/mirror"
import { readJsonCapped } from "@/lib/support/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // Staff viewing as a client, and preview sign-ins, are read-only. Checked here too, not only in the middleware,
  // because someone with no client context never gets a `viewing` flag (review 10/4).
  if (req.cookies.get("cs_view")?.value || (await isPreviewSession())) {
    return NextResponse.json({ error: "read_only" }, { status: 403 })
  }
  const ctx = await getClientContext()
  // Staff outside View as, people who only have scripts, and a script invite's session (SPEC §27 P0 v2) have no
  // client context: they report as themselves, with no client attached.
  const s = ctx ? null : await sessionUser()
  const user = ctx ? ctx.user : s ? s.person : null
  if (!user) return NextResponse.json({ error: "sign_in" }, { status: 401 })
  if (ctx?.viewing) return NextResponse.json({ error: "read_only" }, { status: 403 })
  const read = await readJsonCapped(req, MAX_BODY)
  if (!read.ok) return NextResponse.json({ error: read.status === 413 ? "too_big" : "bad_request" }, { status: read.status })
  const body = read.body
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  const r = await createTicket({
    personId: user.id,
    orgId: ctx?.org.id,
    role: ctx ? ctx.role : user.is_staff && !s?.scope ? "STAFF" : null,
    message: body.message,
    route: body.route,
    onClientHost: host.startsWith("client."),
    ip: clientIp(req.headers),
    ua: req.headers.get("user-agent"),
    context: body.context,
    screenshot: body.screenshot,
  })
  if (!r.ok) return NextResponse.json({ error: r.why }, { status: r.why === "limit" ? 429 : 400 })
  // Out to Majordomo's intake now (the boot loop retries a write this misses).
  void mirrorTickets().catch((err) => console.error("support: mirror failed", err))
  return NextResponse.json({ number: r.number })
}
