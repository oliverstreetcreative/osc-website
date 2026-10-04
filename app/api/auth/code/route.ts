// POST /api/auth/code {email, code, redirect?}: the 6-digit code from the sign-in email, typed on ANY device
// (SPEC §27 P0 v2). Same origin. Tries are RESERVED before comparing (a parallel burst gets 5, not 200); only guesses
// against a live code count; a browser that has signed in as this person before skips the per-address cap. With no
// live code, a dummy comparison and the same answer. A right code spends the invite (link and code are one) and signs
// in THIS browser.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clientHome, deviceLabel, startSession } from "@/lib/auth/session"
import { CODE_LIMITS, codeHash, codeMatches, normalizeCode, safeRedirect } from "@/lib/auth/front-door"
import { decideCodeTry, ensureDevice, hashesFor, noticeIfNewDevice, recordCodeFail, recordEvent } from "@/lib/auth/door"
import { readJsonCapped, sameOrigin } from "@/lib/support/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const wrong = () => NextResponse.json({ error: "wrong" }, { status: 400 })

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 })
  const read = await readJsonCapped(req, 4000)
  if (!read.ok) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  const email = String(read.body.email ?? "").trim().toLowerCase()
  const code = normalizeCode(read.body.code)
  const secret = process.env.SESSION_JWT_SECRET
  if (!email || !code || !secret) return wrong()

  const person = await db.person.findUnique({ where: { email }, select: { id: true, email: true, role: true, is_staff: true, portal_allowed: true } })
  const invite = person?.portal_allowed
    ? await db.portalInvite.findFirst({
        where: { person_id: person.id, accepted_at: null, expires_at: { gt: new Date() }, code_hash: { not: null } },
        orderBy: { created_at: "desc" },
      })
    : null
  if (!person || !invite) {
    codeMatches(codeHash("none", "000000", secret), "none", code, secret) // the same work either way
    return wrong()
  }

  // The answer for a wrong code carries the browser's device cookie too, so a later right code is "this device".
  const probe = NextResponse.json({})
  const deviceId = ensureDevice(req, probe)
  const h = hashesFor(req, email, deviceId)
  const gate = await decideCodeTry(h, person.id, invite.code_tries)
  if (!gate.ok) return NextResponse.json({ error: "too_many" }, { status: 429 })

  // Reserve the try BEFORE comparing: one atomic statement, so tries can't be raced past the cap.
  const reserved = await db.portalInvite.updateMany({
    where: { id: invite.id, code_tries: { lt: CODE_LIMITS.triesPerCode }, accepted_at: null, expires_at: { gt: new Date() } },
    data: { code_tries: { increment: 1 } },
  })
  if (reserved.count !== 1) return NextResponse.json({ error: "too_many" }, { status: 429 })

  if (!codeMatches(invite.code_hash, invite.id, code, secret)) {
    await recordCodeFail(h)
    const res = wrong()
    for (const c of probe.cookies.getAll()) res.cookies.set(c)
    return res
  }
  const spent = await db.portalInvite.updateMany({
    where: { id: invite.id, accepted_at: null, expires_at: { gt: new Date() } },
    data: { accepted_at: new Date() },
  })
  if (spent.count !== 1) return wrong()

  const asked = safeRedirect(read.body.redirect)
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  let dest = invite.redirect ?? asked ?? (person.is_staff || person.role === "STAFF" ? (host.startsWith("login.") ? "/admin" : "/client/view-as") : person.role === "CREW" ? "/crew" : "/client")
  if (dest === "/client") dest = await clientHome(person.id)
  const res = NextResponse.json({ redirectTo: dest })
  for (const c of probe.cookies.getAll()) res.cookies.set(c)
  const { sid } = await startSession(req, res, person, { deviceId })
  void recordEvent("code_ok", h)
  void noticeIfNewDevice(person, deviceId, deviceLabel(req.headers.get("user-agent")), sid).catch(() => {})
  return res
}
