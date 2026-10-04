// POST /api/auth/verify (form: token): the TAP on /magic (SPEC §27 P0 v2). Three checks, then a session on THIS
// browser and a 303 to where they were going:
//   1. same origin (no login-CSRF: someone else's token forced into your browser);
//   2. this browser's osc_device is the one that asked for the link (a scanner, a forward, the mail app's own
//      browser, another device: none has it). If not, NOTHING is spent: they go to the code field instead;
//   3. the spend is atomic (two taps, one sign-in).
import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { db } from "@/lib/db"
import { clientHome, startSession, deviceLabel } from "@/lib/auth/session"
import { deviceHash } from "@/lib/auth/front-door"
import { deviceFrom, hashesFor, noticeIfNewDevice, recordEvent } from "@/lib/auth/door"
import { publicOrigin } from "@/lib/client/host"
import { sameOrigin } from "@/lib/support/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function homeFor(role: string, isStaff: boolean, host: string): string {
  // Staff: the admin on the login host; anywhere else, the client site's "View as client" picker on the same host.
  if (isStaff || role === "STAFF") return host.startsWith("login.") ? "/admin" : "/client/view-as"
  if (role === "CREW") return "/crew"
  return "/client"
}

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req)
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`, 303)
  if (!sameOrigin(req)) return to("/login?link=invalid")
  const form = await req.formData().catch(() => null)
  const token = String(form?.get("token") ?? "")
  if (!/^[0-9a-f]{64}$/.test(token)) return to("/login?link=invalid")

  const invite = await db.portalInvite.findUnique({
    where: { magic_link_hash: createHash("sha256").update(token).digest("hex") },
    include: { person: { select: { id: true, email: true, role: true, is_staff: true, portal_allowed: true } } },
  })
  if (!invite || invite.accepted_at || invite.expires_at <= new Date() || !invite.person.portal_allowed) return to("/login?link=used")

  // Only the browser that asked. Anywhere else spends nothing: the code (same email) is the way in there.
  const deviceId = deviceFrom(req)
  if (!deviceId || !invite.device_hash || deviceHash(deviceId) !== invite.device_hash) return to("/login?code=1")

  const spent = await db.portalInvite.updateMany({
    where: { id: invite.id, accepted_at: null, expires_at: { gt: new Date() } },
    data: { accepted_at: new Date() },
  })
  if (spent.count !== 1) return to("/login?link=used")

  const { person } = invite
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase()
  let dest = invite.redirect ?? homeFor(person.role, person.is_staff, host)
  // A client whose only business with us is a script lands on their scripts, not an empty portal (SPEC §14).
  if (dest === "/client") dest = await clientHome(person.id)
  const res = to(dest)
  const { sid } = await startSession(req, res, person, { deviceId })
  void recordEvent("link_ok", hashesFor(req, person.email, deviceId))
  void noticeIfNewDevice(person, deviceId, deviceLabel(req.headers.get("user-agent")), sid).catch(() => {})
  return res
}
