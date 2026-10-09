// Who may open a script, and as what (SPEC §14 v4 #11, #12; §16 freelancer test). Server only.
//   OSC staff: editor on every script (read-only while viewing the site as a client).
//   Everyone else: their best ScriptAccess row (their own, or their organization's), not revoked, not expired, and
//   only once Sam has shared the script (audience no longer "office").
// The session facts are read ONCE per request (sessionFacts); roleOf() is pure database, so a long-lived event
// stream can re-check access every minute after the request scope is gone.
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { sessionUser } from "@/lib/auth/require-session"
import { mayViewClientSite } from "@/lib/auth/signin-only"
import { personCode } from "../marks"

export type ScriptRole = "viewer" | "commenter" | "suggester" | "editor"
const RANK: Record<ScriptRole, number> = { viewer: 1, commenter: 2, suggester: 3, editor: 4 }
export const atLeast = (role: ScriptRole, min: ScriptRole) => RANK[role] >= RANK[min]
const isRole = (r: string): r is ScriptRole => r in RANK

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SessionFacts = {
  /** The session row (the live stream re-checks it: "Sign out everywhere" ends a stream within a minute). */
  sid: string
  /** A script invite's session (SPEC §27 P0 v2): it opens THIS script and nothing else. */
  scopeScriptId: string | null
  person: { id: string; name: string; email: string; code: string }
  /** OSC staff acting as staff (not viewing the site as a client). */
  staff: boolean
  /** OSC staff, in whatever mode (viewing as a client they still READ every script: v4 #12). */
  realStaff: boolean
  /** Why this session may only read, whatever its role: a staging preview sign-in, or staff viewing as a client. */
  readOnly: string | null
}

export async function sessionFacts(): Promise<SessionFacts | null> {
  const s = await sessionUser()
  if (!s) return null
  const user = s.person
  // Sam's test phase (SPEC §33 v2, built review #1): a script is a client page, so while the switch is on only staff
  // and the listed addresses open one (crew may sign in, and still see no client's script), as the invite route does.
  if (!mayViewClientSite(user)) return null
  const jar = await cookies()
  const viewingAs = !!jar.get("cs_view")?.value
  const preview = s.preview || s.kind === "preview"
  const scoped = !!s.scope
  return {
    sid: s.sid,
    scopeScriptId: s.scope?.id ?? null,
    person: { id: user.id, name: user.name, email: user.email, code: personCode(user.id) },
    staff: user.is_staff && !viewingAs && !scoped,
    realStaff: user.is_staff && !scoped,
    readOnly: preview ? "This is a preview sign-in: it can read scripts, not change them." : viewingAs ? "You're viewing the site as a client: read-only." : null,
  }
}

export type ScriptAccessInfo = { role: ScriptRole; readOnly: string | null }

/** The role `facts` has on the script, or null for no access at all. Database only. */
export async function roleOf(scriptId: string, facts: SessionFacts): Promise<ScriptAccessInfo | null> {
  if (!UUID.test(scriptId)) return null
  if (facts.scopeScriptId && facts.scopeScriptId !== scriptId.toLowerCase()) return null
  const script = await db.script.findUnique({ where: { id: scriptId }, select: { audience: true, archived_at: true, read_only: true } })
  if (!script) return null
  const scriptReadOnly = script.archived_at
    ? "This script is archived."
    : script.read_only
      ? "The client's own document is the source for now, so this copy is read-only."
      : null
  if (facts.staff) return { role: "editor", readOnly: facts.readOnly ?? scriptReadOnly }
  // Staff viewing the site as a client open the editor read-only (v4 #12), never a 404.
  if (facts.realStaff) return { role: "viewer", readOnly: facts.readOnly ?? "You're viewing the site as a client: read-only." }
  if (script.audience === "office") return null // until Sam shares it, nobody but OSC staff sees it
  const orgIds = (
    await db.membership.findMany({ where: { person_id: facts.person.id, hidden: false }, select: { organization_id: true } })
  ).map((m) => m.organization_id)
  const now = new Date()
  const rows = await db.scriptAccess.findMany({
    where: {
      script_id: scriptId,
      revoked_at: null,
      AND: [
        { OR: [{ person_id: facts.person.id }, ...(orgIds.length ? [{ organization_id: { in: orgIds } }] : [])] },
        { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
      ],
    },
    select: { role: true },
  })
  let role: ScriptRole | null = null
  for (const r of rows) if (isRole(r.role) && (!role || RANK[r.role] > RANK[role])) role = r.role
  return role ? { role, readOnly: facts.readOnly ?? scriptReadOnly } : null
}

/**
 * Bind Yjs clientIDs to this person for this script (SPEC v4 #5: a clientID belongs to exactly one person). A clientID
 * nobody has used yet becomes theirs (a reopened tab sends what it typed offline under its old clientID); one bound
 * to someone else is refused. Returns every clientID bound to them on this script, or null on a clash.
 */
export async function bindClients(scriptId: string, personId: string, clientIds: number[]): Promise<Set<number> | null> {
  const wanted = [...new Set(clientIds)].filter((c) => Number.isInteger(c) && c >= 0 && c < 2 ** 32)
  if (wanted.length !== new Set(clientIds).size) return null
  const existing = await db.scriptClient.findMany({ where: { script_id: scriptId, client_id: { in: wanted.map(BigInt) } } })
  if (existing.some((e) => e.person_id !== personId)) return null
  const known = new Set(existing.map((e) => Number(e.client_id)))
  const fresh = wanted.filter((c) => !known.has(c))
  if (fresh.length) {
    await db.scriptClient.createMany({
      data: fresh.map((c) => ({ script_id: scriptId, client_id: BigInt(c), person_id: personId })),
      skipDuplicates: true,
    })
    // a race with another person binding the same id at the same moment: re-read and refuse if it isn't ours
    const again = await db.scriptClient.findMany({ where: { script_id: scriptId, client_id: { in: fresh.map(BigInt) } } })
    if (again.some((e) => e.person_id !== personId)) return null
  }
  const mine = await db.scriptClient.findMany({ where: { script_id: scriptId, person_id: personId }, select: { client_id: true } })
  return new Set(mine.map((m) => Number(m.client_id)))
}
