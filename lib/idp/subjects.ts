// The one sign-in's subjects and admission, from the database (client-website SPEC §27 P1 v2 #2). Server only.
import { db } from "@/lib/db"
import { admit, normEmail, type Admission, type GrantLite } from "./rules"

export const ownerEmail = () => normEmail(process.env.OSC_OWNER_EMAIL ?? "")

/**
 * The stable subject for an address (and its person, if any): found by person first (a subject is tied to its
 * person), then by email; created on first use. A unique-key race with a concurrent sign-in is retried once.
 */
export async function subjectFor(input: { email: string; personId?: string | null }): Promise<{ id: string }> {
  const email = normEmail(input.email)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (input.personId) {
        const mine = await db.idpSubject.findUnique({ where: { person_id: input.personId }, select: { id: true, email: true } })
        if (mine) return mine
      }
      const byEmail = await db.idpSubject.findUnique({ where: { email }, select: { id: true, person_id: true } })
      if (byEmail) {
        // An address first seen without a person (a deputy, a pushed identity) becomes that person's when one appears.
        if (input.personId && !byEmail.person_id) await db.idpSubject.update({ where: { id: byEmail.id }, data: { person_id: input.personId } })
        return { id: byEmail.id }
      }
      return await db.idpSubject.create({ data: { email, person_id: input.personId ?? null }, select: { id: true } })
    } catch (err) {
      if (attempt === 1 || (err as { code?: string })?.code !== "P2002") throw err
    }
  }
  throw new Error("unreachable")
}

/** Live and recent grants for an address, as the pure rules read them. */
export async function grantsFor(email: string): Promise<GrantLite[]> {
  const rows = await db.deputyGrant.findMany({ where: { email: normEmail(email), revoked_at: null } })
  return rows.map((g) => ({
    email: g.email,
    surfaces: g.surfaces,
    scope: g.scope === "all" ? "all" : Array.isArray(g.scope) ? (g.scope as unknown[]).filter((x): x is string => typeof x === "string") : [],
    until: g.until,
    revoked_at: g.revoked_at,
  }))
}

/** Who may sign in, by address (P1 v2 #2): the one rule, with the database's facts. */
export async function admission(email: string, now = new Date()): Promise<Admission> {
  const e = normEmail(email)
  const [person, grants] = await Promise.all([
    db.person.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, portal_allowed: true } }),
    grantsFor(e),
  ])
  return admit({ person, owner: !!ownerEmail() && e === ownerEmail(), grants, now })
}
