// Support tickets: the server side of "Something's wrong?" (SPEC §29 v2). Server only. Everything a report carries is
// UNTRUSTED: lib/support/clean.ts caps, redacts and enums it; this keeps it in Postgres, within the limits; only
// lib/support/safety.ts's summary ever leaves.
import { db } from "@/lib/db"
import { IS_PRODUCTION, IS_STAGING } from "@/lib/site-env"
import { deviceOf, routeTemplate } from "./safety"
import { cleanContext, cleanWords, decodeScreenshot, ipHash } from "./clean"

export { MAX_BODY } from "./clean"
export const supportEnv = (): "production" | "staging" | "local" => (IS_PRODUCTION ? "production" : IS_STAGING ? "staging" : "local")
const LIMITS = { personHour: 5, personDay: 20, ipHour: 10, signedOutIpHour: 3, signedOutDay: 20, globalDay: 200 }

export type NewTicket = {
  personId?: string
  orgId?: string
  role?: string | null
  reporterEmail?: string
  message: unknown
  route: unknown
  onClientHost: boolean
  ip: string | null
  /** The User-Agent header: only its device class and browser family are kept (deviceOf), never the string. */
  ua?: string | null
  context: unknown
  screenshot?: unknown
}

export type TicketResult = { ok: true; id: string; number: number } | { ok: false; why: "empty" | "limit" }

/** Make the ticket, within the limits (counted in Postgres, so a restart or a second container can't reset them). */
export async function createTicket(t: NewTicket): Promise<TicketResult> {
  const words = cleanWords(t.message)
  if (!words) return { ok: false, why: "empty" }
  const ip = ipHash(t.ip)
  const hour = new Date(Date.now() - 3600_000)
  const day = new Date(Date.now() - 86400_000)
  const signedOut = !t.personId
  const [personHour, personDay, ipHour, outDay, allDay] = await Promise.all([
    t.personId ? db.supportTicket.count({ where: { person_id: t.personId, created_at: { gte: hour } } }) : 0,
    t.personId ? db.supportTicket.count({ where: { person_id: t.personId, created_at: { gte: day } } }) : 0,
    ip ? db.supportTicket.count({ where: { ip_hash: ip, created_at: { gte: hour } } }) : 0,
    signedOut ? db.supportTicket.count({ where: { person_id: null, created_at: { gte: day } } }) : 0,
    db.supportTicket.count({ where: { created_at: { gte: day } } }),
  ])
  const over = signedOut
    ? ipHour >= LIMITS.signedOutIpHour || outDay >= LIMITS.signedOutDay || allDay >= LIMITS.globalDay
    : personHour >= LIMITS.personHour || personDay >= LIMITS.personDay || ipHour >= LIMITS.ipHour || allDay >= LIMITS.globalDay
  if (over) return { ok: false, why: "limit" }
  const shot = signedOut ? null : decodeScreenshot(t.screenshot)
  const email = typeof t.reporterEmail === "string" ? t.reporterEmail.trim().toLowerCase().slice(0, 200) : null
  const created = await db.supportTicket.create({
    data: {
      env: supportEnv(),
      person_id: t.personId ?? null,
      organization_id: t.orgId ?? null,
      role: t.role ?? null,
      reporter_email: signedOut && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      route: routeTemplate(t.route, t.onClientHost),
      message: words,
      context: { ...deviceOf(t.ua), ...cleanContext(t.context, t.onClientHost) },
      has_screenshot: !!shot,
      ip_hash: ip,
      ...(shot ? { attachments: { create: { mime: "image/jpeg", bytes: new Uint8Array(shot), size: shot.length } } } : {}),
    },
    select: { id: true, number: true },
  })
  return { ok: true, id: created.id, number: created.number }
}
