// Approve a script (SPEC §14 v4 #7; like §13's approval of record).
// GET: the approvals and whether this person may approve now. POST {note?}: an approver (an email on the script's
// `approvers` list, with access) approves the script AS IT STANDS, only when no suggestion is pending. The approval
// freezes a new "Approved" version and the sha256 of its text, with who, when, IP and device: a dated receipt. With
// `approval: any` one approver makes the script approved; with `all`, every approver must approve the same text.
import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { catchUp, withLive } from "@/lib/scripts/server/registry"
import { saveVersion } from "@/lib/scripts/server/versions"
import { pendingSuggestions, pmSnapshot } from "@/lib/scripts/doc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const approverList = (v: unknown) => (Array.isArray(v) ? v.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()) : [])

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  if (!(await roleOf(params.id, facts))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const script = await db.script.findUnique({ where: { id: params.id }, select: { approvers: true, approval: true, status: true } })
  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const approvals = await db.scriptApproval.findMany({ where: { script_id: params.id }, orderBy: { created_at: "desc" } })
  const list = approverList(script.approvers)
  return NextResponse.json({
    status: script.status,
    approval: script.approval,
    can_approve: list.includes(facts.person.email.toLowerCase()),
    approvals: approvals.map((a) => ({ version_n: a.version_n, name: a.name, at: a.created_at.toISOString(), note: a.note, text_sha256: a.text_sha256 })),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly) return NextResponse.json({ error: access.readOnly }, { status: 403 })
  const script = await db.script.findUnique({ where: { id: params.id }, select: { approvers: true, approval: true } })
  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const list = approverList(script.approvers)
  const me = facts.person.email.toLowerCase()
  if (!list.includes(me)) return NextResponse.json({ error: "You're not an approver on this script." }, { status: 403 })
  const b = (await req.json().catch(() => ({}))) as { note?: unknown }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) || null : null

  const result = await withLive(params.id, async (l) => {
    await catchUp(l)
    const pending = pendingSuggestions(pmSnapshot(l.doc))
    if (pending) return { error: `There ${pending === 1 ? "is 1 suggestion" : `are ${pending} suggestions`} still waiting. Accept or reject them first.` }
    const v = await saveVersion(l, "approved", "Approved", facts.person.id)
    const version = await db.scriptVersion.findUnique({ where: { script_id_n: { script_id: params.id, n: v.n } }, select: { text: true } })
    const sha = createHash("sha256").update(version!.text).digest("hex")
    await db.scriptApproval.create({
      data: {
        script_id: params.id,
        version_n: v.n,
        text_sha256: sha,
        person_id: facts.person.id,
        name: facts.person.name,
        email: me,
        ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        note,
      },
    })
    const approvedBy = new Set(
      (await db.scriptApproval.findMany({ where: { script_id: params.id, text_sha256: sha }, select: { email: true } })).map((a) => a.email.toLowerCase()),
    )
    const done = script.approval === "all" ? list.every((e) => approvedBy.has(e)) : true
    if (done) await db.script.update({ where: { id: params.id }, data: { status: "approved" } })
    return { version_n: v.n, text_sha256: sha, approved: done }
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(result)
}
