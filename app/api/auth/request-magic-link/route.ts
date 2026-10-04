// POST /api/auth/request-magic-link {email, redirect?}: "Email me a sign-in link" (SPEC §27 P0 v2).
// - Same origin only, and the answer is ALWAYS {ok: true}: nothing says whether the address exists or was limited.
// - This browser gets its device cookie (osc_device); the invite keeps its hash, so the link signs in only this
//   browser. Anywhere else, the 6-digit code in the same email.
// - Counted under one lock (lib/auth/door.ts): per address, per network; a browser that has signed in as this person
//   before skips the per-address caps; global numbers only raise an alarm.
// - A new request ends the person's older unspent invites (one live code at a time). The email goes AFTER the answer.
import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHash, randomUUID } from "crypto"
import { db } from "@/lib/db"
import { IS_PRODUCTION } from "@/lib/site-env"
import { publicOrigin } from "@/lib/client/host"
import { magicLinkOrigin } from "@/lib/auth/link-origin"
import { codeHash, newCode, safeRedirect } from "@/lib/auth/front-door"
import { decideLink, ensureDevice, hashesFor, mayEmail, raiseAlarm, sendSignIn } from "@/lib/auth/door"
import { readJsonCapped, sameOrigin } from "@/lib/support/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TTL_MINUTES = 15

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 })
  const read = await readJsonCapped(req, 4000)
  if (!read.ok) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  const email = String(read.body.email ?? "").trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  const deviceId = ensureDevice(req, res)
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) return res // misconfigured: the same answer, nothing sent (logged by whatever needs the secret)

  const person = await db.person.findUnique({ where: { email }, select: { id: true, portal_allowed: true, role: true, is_staff: true } })
  // Who may get a link: a portal-allowed person, and on staging only OSC addresses (staging never emails a client).
  const eligible = person && person.portal_allowed && mayEmail(email) ? person : null
  const h = hashesFor(req, email, deviceId)
  const { send, alarm } = await decideLink(h, eligible?.id ?? null)
  if (alarm) raiseAlarm(alarm)
  if (!send || !eligible) return res

  // One live invite per person: older unspent ones end now.
  await db.portalInvite.updateMany({
    where: { person_id: eligible.id, accepted_at: null, expires_at: { gt: new Date() } },
    data: { expires_at: new Date() },
  })
  const id = randomUUID()
  const token = randomBytes(32).toString("hex")
  const code = newCode()
  await db.portalInvite.create({
    data: {
      id,
      person_id: eligible.id,
      magic_link_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: new Date(Date.now() + TTL_MINUTES * 60_000),
      device_hash: h.device,
      code_hash: codeHash(id, code, secret),
      redirect: safeRedirect(read.body.redirect),
    },
  })
  // The link points at the host the person will use (fixed hosts in production, SPEC §26 v2 / §27 P0 #8).
  const origin = magicLinkOrigin({ isProduction: IS_PRODUCTION, requestOrigin: publicOrigin(req), role: eligible.role, isStaff: eligible.is_staff })
  sendSignIn(email, `${origin}/magic?token=${token}`, code, TTL_MINUTES)
  return res
}
