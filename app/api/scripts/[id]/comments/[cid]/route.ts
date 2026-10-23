// PATCH /api/scripts/<id>/comments/<cid> {resolved: boolean}: resolve or reopen a thread (editors, or whoever started
// it). The thread's first comment carries the state. SPEC §14 v1 scope.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { atLeast, roleOf, sessionFacts, UUID } from "@/lib/scripts/server/access"
import { broadcast, openLive } from "@/lib/scripts/server/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, { params }: { params: { id: string; cid: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access || !UUID.test(params.cid)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly) return NextResponse.json({ error: access.readOnly }, { status: 403 })
  const head = await db.scriptComment.findFirst({ where: { id: params.cid, script_id: params.id, parent_id: null } })
  if (!head || (!facts.staff && head.audience !== "client")) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!atLeast(access.role, "editor") && head.author_id !== facts.person.id) {
    return NextResponse.json({ error: "Only editors, or whoever started the thread, can resolve it." }, { status: 403 })
  }
  const b = (await req.json().catch(() => ({}))) as { resolved?: unknown }
  if (typeof b.resolved !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 })
  await db.scriptComment.update({
    where: { id: head.id },
    data: b.resolved ? { resolved_at: new Date(), resolved_by: facts.person.id } : { resolved_at: null, resolved_by: null },
  })
  openLive(params.id)
    .then((l) => broadcast(l, "comments", {}))
    .catch(() => undefined)
  return NextResponse.json({ ok: true })
}
