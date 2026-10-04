// POST /client/support/report: "Something's wrong?" from a signed-in client (SPEC §29 v2). Under /client so the
// middleware gives it the session, the same-origin (CSRF) check, the demo's read-only block and View-as's read-only
// block. The body is untrusted: lib/support/store.ts caps, redacts and enums everything it keeps.
import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { clientIp } from "@/lib/client/ip"
import { MAX_BODY, createTicket } from "@/lib/support/store"
import { mirrorTickets } from "@/lib/support/mirror"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? "0")
  if (!len || len > MAX_BODY) return NextResponse.json({ error: "too_big" }, { status: 413 })
  const ctx = await getClientContext()
  if (!ctx) return NextResponse.json({ error: "sign_in" }, { status: 401 })
  // Staff viewing as a client and preview sign-ins are read-only; staff report as themselves, outside View as.
  if (ctx.viewing || req.headers.get("x-user-preview") === "true") return NextResponse.json({ error: "read_only" }, { status: 403 })
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  const r = await createTicket({
    personId: ctx.user.id,
    orgId: ctx.org.id,
    role: ctx.role,
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
