// POST /support/signin-trouble: "Trouble signing in?" from someone who can't sign in (SPEC §29 v2). No session, so it
// checks its own origin; tighter limits; no screenshot; the email they type is unverified and the site never emails
// it. The answer is the same whatever the address. It always reaches Sam (Majordomo's intake).
import { NextRequest, NextResponse } from "next/server"
import { clientIp } from "@/lib/client/ip"
import { createTicket } from "@/lib/support/store"
import { mirrorTickets } from "@/lib/support/mirror"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sameOrigin(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase()
  const from = req.headers.get("origin") ?? req.headers.get("referer")
  if (!from || !host) return false
  try {
    return new URL(from).host.toLowerCase() === host
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 })
  const len = Number(req.headers.get("content-length") ?? "0")
  if (!len || len > 20_000) return NextResponse.json({ error: "too_big" }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  const r = await createTicket({
    reporterEmail: typeof body.email === "string" ? body.email : undefined,
    message: body.message,
    route: body.route,
    onClientHost: host.startsWith("client."),
    ip: clientIp(req.headers),
    ua: req.headers.get("user-agent"),
    context: body.context,
  })
  if (!r.ok) return NextResponse.json({ error: r.why }, { status: r.why === "limit" ? 429 : 400 })
  void mirrorTickets().catch((err) => console.error("support: mirror failed", err))
  // No report number to someone signed out: it would only count everyone's reports.
  return NextResponse.json({ ok: true })
}
