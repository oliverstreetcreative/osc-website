// PATCH /api/scripts/<id>: the script's settings (SPEC §14). Editors: status (draft / ready for notes / ready for OK;
// "approved" only comes from approvals), the target length, the title. OSC staff also: approvers + any/all, the
// version the hub serves on a shoot day. A status of "ready for …" puts the script in the client's Needs you.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { atLeast, roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { versionNameProblem } from "@/lib/scripts/server/versions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUSES = new Set(["draft", "ready_for_notes", "ready_for_ok"])
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly || !atLeast(access.role, "editor")) return NextResponse.json({ error: "Only editors change a script's settings." }, { status: 403 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const data: Record<string, unknown> = {}

  if ("status" in b) {
    if (typeof b.status !== "string" || !STATUSES.has(b.status)) return NextResponse.json({ error: "Bad status" }, { status: 422 })
    data.status = b.status
  }
  if ("target_seconds" in b) {
    if (b.target_seconds === null) data.target_seconds = null
    else if (typeof b.target_seconds === "number" && b.target_seconds > 0 && b.target_seconds <= 3600) data.target_seconds = Math.round(b.target_seconds)
    else return NextResponse.json({ error: "A length in seconds, please." }, { status: 422 })
  }
  if ("title" in b) {
    const t = typeof b.title === "string" ? b.title.trim() : ""
    const problem = versionNameProblem(t)
    if (problem) return NextResponse.json({ error: problem.replace("version", "script") }, { status: 422 })
    data.title = t
  }
  if ("approvers" in b || "approval" in b || "shoot_version" in b) {
    if (!facts.staff) return NextResponse.json({ error: "Only OSC staff set approvers and the shoot version." }, { status: 403 })
    if ("approvers" in b) {
      if (!Array.isArray(b.approvers) || b.approvers.length > 10 || !b.approvers.every((e) => typeof e === "string" && EMAIL.test(e))) {
        return NextResponse.json({ error: "Approvers are email addresses." }, { status: 422 })
      }
      data.approvers = (b.approvers as string[]).map((e) => e.trim().toLowerCase())
    }
    if ("approval" in b) {
      if (b.approval !== "any" && b.approval !== "all") return NextResponse.json({ error: "any or all" }, { status: 422 })
      data.approval = b.approval
    }
    if ("shoot_version" in b) {
      if (b.shoot_version === null) data.shoot_version = null
      else {
        const n = Number(b.shoot_version)
        const v = Number.isInteger(n) ? await db.scriptVersion.findUnique({ where: { script_id_n: { script_id: params.id, n } }, select: { n: true } }) : null
        if (!v) return NextResponse.json({ error: "No such version" }, { status: 422 })
        data.shoot_version = n
      }
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 })
  await db.script.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true })
}
