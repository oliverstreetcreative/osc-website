// Script invites (SPEC §14 v4 #10): a 14-day link, spent only by a TAP on its page (never on load, so mail scanners
// and link previews can't burn it), landing on the script, never /client. Only the token's sha256 is stored.
import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"

export const INVITE_DAYS = 14
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex")

/** A new invite for an access row; returns the raw token (shown once: the link). */
export async function newInvite(accessId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url")
  await db.scriptInvite.create({
    data: { access_id: accessId, token_hash: hashToken(token), expires_at: new Date(Date.now() + INVITE_DAYS * 86400000) },
  })
  return token
}

export type InviteState =
  | { ok: true; inviteId: string; accessId: string; scriptId: string; title: string; sharer: string; person: { id: string; email: string; role: string; is_staff: boolean; portal_allowed: boolean } }
  | { ok: false; why: "unknown" | "spent" | "expired" | "revoked"; accessId?: string; email?: string | null; title?: string }

/** What a token opens, without spending it. */
export async function readInvite(token: string): Promise<InviteState> {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return { ok: false, why: "unknown" }
  const inv = await db.scriptInvite.findUnique({
    where: { token_hash: hashToken(token) },
    include: {
      access: {
        include: {
          script: { select: { id: true, title: true, archived_at: true } },
          person: { select: { id: true, email: true, role: true, is_staff: true, portal_allowed: true } },
        },
      },
    },
  })
  if (!inv) return { ok: false, why: "unknown" }
  const a = inv.access
  const base = { accessId: a.id, email: a.person?.email ?? a.email, title: a.script.title }
  if (a.revoked_at || a.script.archived_at || !a.person || !a.person.portal_allowed) return { ok: false, why: "revoked", ...base }
  if (a.expires_at && a.expires_at < new Date()) return { ok: false, why: "revoked", ...base }
  if (inv.spent_at) return { ok: false, why: "spent", ...base }
  if (inv.expires_at < new Date()) return { ok: false, why: "expired", ...base }
  const sharer = await db.person.findUnique({ where: { id: a.invited_by }, select: { first_name: true, name: true } })
  return {
    ok: true,
    inviteId: inv.id,
    accessId: a.id,
    scriptId: a.script.id,
    title: a.script.title,
    sharer: (sharer?.first_name || sharer?.name || "Oliver Street Creative").trim().split(/\s+/)[0],
    person: a.person,
  }
}

/** Spend an invite (the tap): once only, atomically. True when this call spent it. */
export async function spendInvite(inviteId: string, accessId?: string): Promise<boolean> {
  const r = await db.scriptInvite.updateMany({ where: { id: inviteId, spent_at: null, expires_at: { gt: new Date() } }, data: { spent_at: new Date() } })
  if (r.count !== 1) return false
  if (accessId) await db.scriptAccess.updateMany({ where: { id: accessId, accepted_at: null }, data: { accepted_at: new Date() } })
  return true
}
