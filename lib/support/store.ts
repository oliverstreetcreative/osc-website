// Support tickets: the server side of "Something's wrong?" (SPEC §29 v2). Server only. Everything a report carries is
// UNTRUSTED: lib/support/clean.ts caps, redacts and enums it; this keeps it in Postgres, within the limits; only
// lib/support/safety.ts's summary ever leaves.
import { db } from "@/lib/db"
import { IS_PRODUCTION, IS_STAGING } from "@/lib/site-env"
import { deviceOf, routeTemplate } from "./safety"
import { cleanContext, cleanWords, decodeScreenshot, ipHash, overLimits } from "./clean"

export { MAX_BODY } from "./clean"
export const supportEnv = (): "production" | "staging" | "local" => (IS_PRODUCTION ? "production" : IS_STAGING ? "staging" : "local")
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

// Every report takes this one lock for its count-then-insert, so 200 requests fired at once are counted one after
// another, never all against the same "0 so far" (review 10/4 MUST-FIX). Reports are rare; serialising costs nothing.

/** Make the ticket, within the limits (counted in Postgres, so a restart or a second container can't reset them). */
export async function createTicket(t: NewTicket): Promise<TicketResult> {
  const words = cleanWords(t.message)
  if (!words) return { ok: false, why: "empty" }
  const ip = ipHash(t.ip)
  const signedOut = !t.personId
  const shot = signedOut ? null : decodeScreenshot(t.screenshot)
  const email = typeof t.reporterEmail === "string" ? t.reporterEmail.trim().toLowerCase().slice(0, 200) : null
  return db.$transaction(
    async (tx) => {
      // $executeRaw, not $queryRaw: the lock function returns void, which a query can't read back.
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(290429)") // a constant: nothing user-supplied
      const hour = new Date(Date.now() - 3600_000)
      const day = new Date(Date.now() - 86400_000)
      const [personHour, personDay, ipHour, outDay, allDay] = await Promise.all([
        t.personId ? tx.supportTicket.count({ where: { person_id: t.personId, created_at: { gte: hour } } }) : 0,
        t.personId ? tx.supportTicket.count({ where: { person_id: t.personId, created_at: { gte: day } } }) : 0,
        ip ? tx.supportTicket.count({ where: { ip_hash: ip, created_at: { gte: hour } } }) : 0,
        signedOut ? tx.supportTicket.count({ where: { person_id: null, created_at: { gte: day } } }) : 0,
        tx.supportTicket.count({ where: { created_at: { gte: day } } }),
      ])
      if (overLimits({ signedOut, personHour, personDay, ipHour, outDay, allDay })) return { ok: false, why: "limit" } as const
      const created = await tx.supportTicket.create({
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
      return { ok: true, id: created.id, number: created.number } as const
    },
    { timeout: 15_000, maxWait: 15_000 },
  )
}
