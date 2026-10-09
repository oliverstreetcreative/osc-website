// Script notices (SPEC §14 v1 scope): email on a new comment or a suggestion, BATCHED, never more than one email per
// person per 15 minutes. The email names the scripts and counts what happened; it never carries the script text or a
// comment's words (open the portal to read them). Server only.
import { db } from "@/lib/db"
import { IS_PRODUCTION } from "@/lib/site-env"
import { escapeHtml, sendScriptMail } from "./mail"
import { mayMailClient } from "@/lib/auth/signin-only"
import { appOrigin } from "@/lib/app/routes"

const QUIET_MS = 15 * 60 * 1000
export type NoticeKind = "comment" | "suggestion" | "shared" | "mention"

/** Who hears about activity on a script: whoever made it and everyone it's shared with (staff only for internal). */
async function audienceOf(scriptId: string, internal: boolean): Promise<string[]> {
  const script = await db.script.findUnique({ where: { id: scriptId }, select: { created_by: true, audience: true } })
  if (!script) return []
  const ids = new Set<string>([script.created_by])
  if (!internal && script.audience !== "office") {
    const now = new Date()
    const access = await db.scriptAccess.findMany({
      where: { script_id: scriptId, revoked_at: null, person_id: { not: null }, OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
      select: { person_id: true },
    })
    for (const a of access) if (a.person_id) ids.add(a.person_id)
  }
  return [...ids]
}

const recent = new Map<string, number>() // script|kind|actor → last time recorded (typing sends many updates)

/** Record that something happened (one pending notice per person, script and kind; the batch counts the rest). */
export async function notify(scriptId: string, kind: NoticeKind, actorId: string, opts: { internal?: boolean } = {}) {
  const key = `${scriptId}|${kind}|${actorId}|${opts.internal ? 1 : 0}`
  const now = Date.now()
  if (now - (recent.get(key) ?? 0) < 60_000) return
  recent.set(key, now)
  if (recent.size > 5000) recent.clear()
  const people = (await audienceOf(scriptId, !!opts.internal)).filter((p) => p !== actorId)
  for (const person_id of people) {
    const pending = await db.scriptNotice.findFirst({ where: { person_id, script_id: scriptId, kind, sent_at: null }, select: { id: true } })
    if (!pending) await db.scriptNotice.create({ data: { person_id, script_id: scriptId, kind } })
  }
}

/**
 * "@Sam" in a comment: the people on this script whose first name matches get a "mention" notice. In an internal
 * comment only OSC staff can be mentioned (v4 #11). Returns who was mentioned.
 */
export async function notifyMentions(scriptId: string, body: string, actorId: string, internal: boolean): Promise<string[]> {
  const names = new Set([...body.matchAll(/(?:^|[\s(])@([\p{L}][\p{L}'-]{0,30})/gu)].map((m) => m[1].toLowerCase()))
  if (!names.size) return []
  const ids = new Set(await audienceOf(scriptId, false))
  const staff = await db.person.findMany({ where: { is_staff: true }, select: { id: true } })
  for (const s of staff) ids.add(s.id)
  const people = await db.person.findMany({
    where: { id: { in: [...ids] }, ...(internal ? { is_staff: true } : {}) },
    select: { id: true, first_name: true, name: true },
  })
  const hit = people.filter((p) => p.id !== actorId && names.has((p.first_name || p.name || "").trim().split(/\s+/)[0].toLowerCase()))
  for (const p of hit) {
    const pending = await db.scriptNotice.findFirst({ where: { person_id: p.id, script_id: scriptId, kind: "mention", sent_at: null }, select: { id: true } })
    if (!pending) await db.scriptNotice.create({ data: { person_id: p.id, script_id: scriptId, kind: "mention" } })
  }
  return hit.map((p) => p.id)
}

function origin(): string | null {
  // osc-app (SPEC §33 v2, design review #6): the logged-in site lives on its own host, so its notices link there.
  const app = appOrigin()
  if (app) return app
  if (IS_PRODUCTION) return "https://oliverstreetcreative.com"
  const d = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  return d ? `https://${d}` : null
}

const WORDS: Record<string, [string, string]> = {
  comment: ["a new comment", "new comments"],
  suggestion: ["a suggestion", "suggestions"],
  shared: ["shared with you", "shared with you"],
  mention: ["you were mentioned", "you were mentioned"],
}

/** Send what's due: per person, one email covering every script with news, unless they had one in the last 15 min. */
export async function sendDueNotices() {
  const base = origin()
  if (!base) return
  const due = await db.scriptNotice.findMany({ where: { sent_at: null }, orderBy: { created_at: "asc" }, take: 500 })
  const byPerson = new Map<string, typeof due>()
  for (const n of due) byPerson.set(n.person_id, [...(byPerson.get(n.person_id) ?? []), n])
  for (const [personId, items] of byPerson) {
    const last = await db.scriptNotice.findFirst({ where: { person_id: personId, sent_at: { not: null } }, orderBy: { sent_at: "desc" }, select: { sent_at: true } })
    if (last?.sent_at && Date.now() - last.sent_at.getTime() < QUIET_MS) continue
    const person = await db.person.findUnique({ where: { id: personId }, select: { email: true, portal_allowed: true } })
    const ids = items.map((n) => n.id)
    // Not allowed, or Sam's test phase refuses the address (CLIENT_SIGNIN_ONLY): these notices are consumed, never sent,
    // so lifting the switch later can't release a backlog.
    if (!person?.portal_allowed || !mayMailClient(person.email)) {
      await db.scriptNotice.updateMany({ where: { id: { in: ids } }, data: { sent_at: new Date() } })
      continue
    }
    const scripts = await db.script.findMany({ where: { id: { in: [...new Set(items.map((n) => n.script_id))] }, archived_at: null }, select: { id: true, title: true } })
    const lines = scripts.map((s) => {
      const kinds = [...new Set(items.filter((n) => n.script_id === s.id).map((n) => n.kind))]
      const what = kinds.map((k) => WORDS[k]?.[0] ?? k).join(", ")
      return `<li style="margin: 8px 0;"><a href="${base}/client/scripts/${s.id}" style="color: #a8501a;">${escapeHtml(s.title)}</a>: ${escapeHtml(what)}</li>`
    })
    if (lines.length) {
      const subject = scripts.length === 1 ? `News on “${scripts[0].title}”` : `News on ${scripts.length} scripts`
      const html = `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <p>Since we last wrote:</p><ul style="padding-left: 18px;">${lines.join("")}</ul>
        <p style="color: #666; font-size: 13px;">Open a script to read it. At most one of these every 15 minutes.</p></div>`
      const r = await sendScriptMail(person.email, subject, html)
      if (!r.sent && r.why !== "staging only emails OSC addresses") continue // try again next run
    }
    await db.scriptNotice.updateMany({ where: { id: { in: ids } }, data: { sent_at: new Date() } })
  }
}
