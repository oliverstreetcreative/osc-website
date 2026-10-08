// POST /api/auth/code {email, code, redirect?}: the 6-digit code from the sign-in email, typed on ANY device
// (SPEC §27 P0 v2). Same origin. Built so a real address and an unknown one look the same from outside (built review):
// the device cookie is set first either way, both are counted the same way (and capped the same way), and both get
// the same answers. Tries are RESERVED before comparing (a parallel burst gets 5, not 200); only guesses at a LIVE code
// count toward the alarm. A right code spends the invite (link and code are one) and signs in THIS browser.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clientHome, deviceLabel, startSession } from "@/lib/auth/session"
import { CODE_LIMITS, codeHash, codeMatches, normalizeCode, safeRedirect } from "@/lib/auth/front-door"
import { decideCodeTry, ensureDevice, hashesFor, homeFor, noticeIfNewDevice, recordCodeFail, recordEvent } from "@/lib/auth/door"
import { readJsonCapped, sameOrigin } from "@/lib/support/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 })
  // The device cookie first, for everyone: whether it's set must never tell a real address from an unknown one.
  const probe = NextResponse.json({})
  const deviceId = ensureDevice(req, probe)
  const reply = (body: Record<string, unknown>, status = 200) => {
    const r = NextResponse.json(body, { status })
    for (const c of probe.cookies.getAll()) r.cookies.set(c)
    return r
  }
  const read = await readJsonCapped(req, 4000)
  if (!read.ok) return reply({ error: "bad_request" }, 400)
  const email = String(read.body.email ?? "").trim().toLowerCase()
  const code = normalizeCode(read.body.code)
  const secret = process.env.SESSION_JWT_SECRET
  if (!email || !code || !secret) return reply({ error: "wrong" }, 400)

  const person = await db.person.findUnique({ where: { email }, select: { id: true, email: true, role: true, is_staff: true, portal_allowed: true } })
  const invite = person?.portal_allowed
    ? await db.portalInvite.findFirst({
        where: { person_id: person.id, accepted_at: null, expires_at: { gt: new Date() }, code_hash: { not: null } },
        orderBy: { created_at: "desc" },
      })
    : null
  const h = hashesFor(req, email, deviceId)
  const gate = await decideCodeTry(h, invite && person ? person.id : null, invite?.code_tries ?? 0)
  if (!gate.ok) return reply({ error: "too_many" }, 429)

  if (!person || !invite) {
    codeMatches(codeHash("none", "000000", secret), "none", code, secret) // the same work either way
    await recordCodeFail(h, false)
    return reply({ error: "wrong" }, 400)
  }

  // Reserve the try BEFORE comparing: one atomic statement, so tries can't be raced past the cap.
  const reserved = await db.portalInvite.updateMany({
    where: { id: invite.id, code_tries: { lt: CODE_LIMITS.triesPerCode }, accepted_at: null, expires_at: { gt: new Date() } },
    data: { code_tries: { increment: 1 } },
  })
  if (reserved.count !== 1) return reply({ error: "too_many" }, 429)

  if (!codeMatches(invite.code_hash, invite.id, code, secret)) {
    await recordCodeFail(h, true)
    return reply({ error: "wrong" }, 400)
  }
  const spent = await db.portalInvite.updateMany({
    where: { id: invite.id, accepted_at: null, expires_at: { gt: new Date() } },
    data: { accepted_at: new Date() },
  })
  if (spent.count !== 1) return reply({ error: "wrong" }, 400)

  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  let dest = invite.redirect ?? safeRedirect(read.body.redirect) ?? homeFor(person.role, person.is_staff, host)
  if (dest === "/client") dest = await clientHome(person.id)
  const res = reply({ redirectTo: dest })
  const { sid } = await startSession(req, res, person, { deviceId })
  void recordEvent("code_ok", h)
  void noticeIfNewDevice(person, deviceId, deviceLabel(req.headers.get("user-agent")), sid).catch(() => {})
  return res
}
