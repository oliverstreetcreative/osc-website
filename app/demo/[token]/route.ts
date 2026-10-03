// The DEMO link (client-website SPEC §19 v2): /demo/<token> signs the visitor in as the fictional demo client,
// read-only, on STAGING only. Everything else gets a plain 404: production, a missing or short
// CLIENT_DEMO_TOKEN, a wrong token. The session's JWT carries the token's fingerprint, and middleware checks it
// against the CURRENT token on every request, so rotating the variable (and redeploying) ends every demo session.
import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"
import { db } from "@/lib/db"
import { clearCookies, cookieDomainFor, isSecure, publicOrigin } from "@/lib/client/host"
import { DEMO_EMAIL, DEMO_ORG_SLUG, DEMO_TTL_SECONDS, demoFingerprint, demoOn, demoTokenMatches } from "@/lib/client/demo"

export const dynamic = "force-dynamic"

const QUIET = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" }
const notFound = () => new NextResponse(null, { status: 404, headers: QUIET })

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const secret = process.env.SESSION_JWT_SECRET
  const fingerprint = demoFingerprint()
  if (!demoOn() || !secret || !fingerprint || !demoTokenMatches(params.token ?? "")) return notFound()

  // The demo person and org come from the staging sync (lib/client/demo.ts); both must be live.
  const person = await db.person.findUnique({ where: { email: DEMO_EMAIL } })
  const member = person
    ? await db.membership.findFirst({
        where: { person_id: person.id, hidden: false, organization: { slug: DEMO_ORG_SLUG, hidden: false } },
      })
    : null
  if (!person || !person.portal_allowed || person.is_staff || !member) {
    return new NextResponse("The demo is still being set up. Try again in five minutes.", {
      status: 503,
      headers: { ...QUIET, "content-type": "text/plain; charset=utf-8" },
    })
  }

  const expires = new Date(Date.now() + DEMO_TTL_SECONDS * 1000)
  const jwt = await new SignJWT({ id: person.id, email: person.email, role: person.role, is_staff: false, demo: fingerprint })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(new TextEncoder().encode(secret))

  // Logged like any sign-in. A link preview (iMessage, Slack) fetching the URL shows up here too.
  await db.portalEvent
    .create({
      data: {
        person_id: person.id,
        event_type: "demo_open",
        summary: "The portal demo was opened",
        details: {
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
        },
        source: "portal_client",
      },
    })
    .catch(() => {})

  const res = NextResponse.redirect(`${publicOrigin(req)}/client`, 303)
  for (const [k, v] of Object.entries(QUIET)) res.headers.set(k, v)
  res.cookies.set("osc_session", jwt, {
    domain: cookieDomainFor(req),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    expires,
  })
  // A staff view or the older impersonation in this browser ends here: the demo is its own session.
  // AFTER res.cookies.set: Next's cookie API rewrites the whole Set-Cookie header (one entry per name), and
  // clearCookies appends one raw header per domain.
  clearCookies(res, req, ["cs_view", "osc_impersonating", "cs_org"])
  return res
}
