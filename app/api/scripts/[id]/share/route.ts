// Share a script (SPEC §14 phone moment 1; v4 #10, #11; §16 freelancer test).
// GET: who has access (editors). POST {email, role, name?, expires_at?}: invite by FULL email (no autocomplete over
// OSC's people); OSC staff may give any role, a client Editor up to Suggester. The invitee gets ONE email ("Sam shared
// X with you", a link that signs them in and lands on the script; never the script text). The answer carries the link
// itself for "Copy link" (Mike has no email on record; Sam texts it). DELETE {access_id}: revoke; their stream closes
// within a minute and their next save is refused.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { atLeast, roleOf, sessionFacts, type ScriptRole } from "@/lib/scripts/server/access"
import { newInvite } from "@/lib/scripts/server/invites"
import { inviteEmail, sendScriptMail } from "@/lib/scripts/server/mail"
import { publicOrigin } from "@/lib/client/host"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROLES: ScriptRole[] = ["viewer", "commenter", "suggester", "editor"]
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

async function editorFacts(id: string) {
  const facts = await sessionFacts()
  if (!facts) return { error: NextResponse.json({ error: "Sign in" }, { status: 401 }) }
  const access = await roleOf(id, facts)
  if (!access) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  if (access.readOnly || !atLeast(access.role, "editor")) return { error: NextResponse.json({ error: "Only editors share a script." }, { status: 403 }) }
  return { facts }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await editorFacts(params.id)
  if ("error" in r) return r.error
  const rows = await db.scriptAccess.findMany({
    where: { script_id: params.id, revoked_at: null },
    orderBy: { invited_at: "asc" },
    include: { person: { select: { name: true, email: true } }, organization: { select: { name: true, short_name: true } } },
  })
  return NextResponse.json({
    access: rows.map((a) => ({
      id: a.id,
      who: a.organization ? `${a.organization.short_name ?? a.organization.name} · everyone` : a.person?.name ?? a.email ?? "Someone",
      email: a.person?.email ?? a.email,
      role: a.role,
      accepted: !!a.accepted_at,
      expires_at: a.expires_at?.toISOString() ?? null,
    })),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await editorFacts(params.id)
  if ("error" in r) return r.error
  const { facts } = r
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : ""
  const role = typeof b.role === "string" && (ROLES as string[]).includes(b.role) ? (b.role as ScriptRole) : "suggester"
  if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: "A full email address, please." }, { status: 422 })
  if (!facts.staff && (role === "editor")) return NextResponse.json({ error: "You can invite people up to Suggester." }, { status: 403 })
  let expires: Date | null = null
  if (typeof b.expires_at === "string" && b.expires_at) {
    const d = new Date(b.expires_at)
    if (Number.isNaN(d.getTime()) || d < new Date()) return NextResponse.json({ error: "That end date has passed." }, { status: 422 })
    expires = d
  }

  const script = await db.script.findUnique({ where: { id: params.id }, select: { title: true } })
  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 })
  let person = await db.person.findUnique({ where: { email }, select: { id: true, is_staff: true, portal_allowed: true } })
  if (person?.is_staff) return NextResponse.json({ error: "OSC staff can already edit every script." }, { status: 422 })
  if (person && !person.portal_allowed) return NextResponse.json({ error: "That person can't sign in to the portal." }, { status: 422 })
  if (!person) {
    // An invitee with no organization gets a Person and nothing else (they never see the rest of the portal).
    const name = typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : email.split("@")[0]
    person = await db.person.create({ data: { email, name, role: "CLIENT", is_staff: false }, select: { id: true, is_staff: true, portal_allowed: true } })
  }
  const existing = await db.scriptAccess.findFirst({ where: { script_id: params.id, person_id: person.id, revoked_at: null } })
  const access = existing
    ? await db.scriptAccess.update({ where: { id: existing.id }, data: { role, expires_at: expires } })
    : await db.scriptAccess.create({ data: { script_id: params.id, person_id: person.id, email, role, invited_by: facts.person.id, expires_at: expires } })
  await db.script.update({ where: { id: params.id }, data: { audience: "client" } }) // sharing makes it client-visible

  const token = await newInvite(access.id)
  const link = `${publicOrigin(req)}/client/scripts/invite/${token}`
  const mail = inviteEmail(facts.person.name.split(/\s+/)[0] || "Oliver Street Creative", script.title, link)
  const sent = await sendScriptMail(email, mail.subject, mail.html)
  return NextResponse.json({ ok: true, access_id: access.id, link, emailed: sent.sent, why: sent.sent ? null : sent.why })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const r = await editorFacts(params.id)
  if ("error" in r) return r.error
  const b = (await req.json().catch(() => ({}))) as { access_id?: unknown }
  if (typeof b.access_id !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 })
  const done = await db.scriptAccess.updateMany({ where: { id: b.access_id, script_id: params.id, revoked_at: null }, data: { revoked_at: new Date() } })
  if (!done.count) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await db.scriptInvite.updateMany({ where: { access_id: b.access_id, spent_at: null }, data: { expires_at: new Date() } })
  return NextResponse.json({ ok: true })
}
