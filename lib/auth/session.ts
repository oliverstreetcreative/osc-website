// Start a signed-in session on a response: the one place a session is minted for a person (the sign-in link's
// verify route, and a script invite's tap). A 30-day HS256 JWT in the host-only `osc_session` cookie (shared domain
// only when SESSION_COOKIE_DOMAIN opts in), recorded in portal_sessions.
import type { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { SignJWT } from "jose"
import { db } from "@/lib/db"
import { cookieDomainFor, isSecure } from "@/lib/client/host"

const SESSION_TTL_DAYS = 30

export type SessionPerson = { id: string; email: string; role: string; is_staff: boolean }

export async function startSession(req: NextRequest, res: NextResponse, person: SessionPerson): Promise<void> {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error("SESSION_JWT_SECRET not configured")
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const jwt = await new SignJWT({ id: person.id, email: person.email, role: person.role, is_staff: person.is_staff })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(new TextEncoder().encode(secret))
  await db.portalSession.create({
    data: { person_id: person.id, token_hash: createHash("sha256").update(jwt).digest("hex"), expires_at: expires, last_active_at: new Date() },
  })
  res.cookies.set("osc_session", jwt, {
    domain: cookieDomainFor(req),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    expires,
  })
}

/** Where a client goes after signing in: the portal, or, for someone whose only business with us is a script
 *  (an invitee with no organization: Mike, a freelancer), their scripts (SPEC §14 phone moment 2). */
export async function clientHome(personId: string): Promise<string> {
  const orgs = await db.membership.count({ where: { person_id: personId, hidden: false } })
  if (orgs) return "/client"
  const scripts = await db.scriptAccess.count({ where: { person_id: personId, revoked_at: null } })
  return scripts ? "/client/scripts" : "/client"
}
