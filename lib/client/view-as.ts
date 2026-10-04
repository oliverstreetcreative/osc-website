// "View as client" for OSC staff: start / stop + the audit log.
// The cookie is a signed JWT naming the staff member and the org, valid 8 hours.
// While it exists, middleware.ts refuses every non-GET request except the few
// routes that end the view or sign out (VIEW_AS_ALLOWED_WRITES).
import { SignJWT } from "jose"
import { db } from "@/lib/db"
import { clientIp } from "./ip"

export const VIEW_TTL_SECONDS = 8 * 3600

export async function mintViewCookie(staffId: string, orgSlug: string) {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error("SESSION_JWT_SECRET missing")
  return new SignJWT({ purpose: "view_as", staff_id: staffId, org: orgSlug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + VIEW_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret))
}

/** Every start and stop is logged (PortalEvent, source portal_admin). */
export async function logViewAs(
  kind: "view_as_start" | "view_as_exit",
  staff: { id: string; name: string },
  org: { slug: string; name: string } | null,
  req: Request,
) {
  try {
    await db.portalEvent.create({
      data: {
        person_id: staff.id,
        event_type: kind,
        summary: kind === "view_as_start" ? `${staff.name} viewed the site as ${org?.name}` : `${staff.name} stopped viewing as a client`,
        details: {
          org: org?.slug ?? null,
          ip: clientIp(req.headers), // the LAST hop (lib/client/ip.ts)
          user_agent: req.headers.get("user-agent") ?? null,
        },
        source: "portal_admin",
      },
    })
  } catch (err) {
    console.error("view-as: audit log failed", err)
  }
}
