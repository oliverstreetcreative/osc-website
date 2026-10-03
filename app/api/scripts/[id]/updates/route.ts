// POST /api/scripts/<id>/updates {client_id, update (base64), sub?}: one Yjs update from a browser (SPEC §14 Spike A).
// Suggesters and editors only. The update's clientIDs are bound to the sender (a clientID belongs to one person); a
// suggester's update must pass the guard (lib/scripts/guard.ts); then, inside the per-script lock: catch up with rows
// another container wrote, COMMIT (the database assigns the seq), apply, answer {seq}, pass it on.
// A refusal answers 409 {refused: true, why}: the browser keeps the person's words aside, drops its local copy and
// resyncs (v4 #5).
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { atLeast, bindClients, roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { catchUp, commit, fromB64, withLive } from "@/lib/scripts/server/registry"
import { checkUpdate, updateClients } from "@/lib/scripts/guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_UPDATE_BYTES = 2_000_000

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in to edit this script." }, { status: 401 })
  const access = await roleOf(id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly) return NextResponse.json({ error: access.readOnly, read_only: true }, { status: 403 })
  if (!atLeast(access.role, "suggester")) return NextResponse.json({ error: "You can read and comment on this script, not change it." }, { status: 403 })

  let body: { client_id?: unknown; update?: unknown; sub?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  const clientId = Number(body.client_id)
  if (!Number.isInteger(clientId) || clientId < 0 || clientId >= 2 ** 32 || typeof body.update !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  if (body.update.length > (MAX_UPDATE_BYTES * 4) / 3 + 4) return NextResponse.json({ error: "Too large" }, { status: 413 })
  const update = fromB64(body.update)
  const sub = typeof body.sub === "string" ? body.sub : undefined

  const clients = updateClients(update)
  if (!clients) return NextResponse.json({ refused: true, why: "an update that can't be read" }, { status: 409 })
  const own = await bindClients(id, facts.person.id, [clientId, ...clients])
  if (!own) return NextResponse.json({ refused: true, why: "an update with another person's changes in it" }, { status: 409 })

  const suggester = access.role === "suggester" ? { code: facts.person.code, clientIds: new Set([...own].map(String)) } : null
  const result = await withLive(id, async (l) => {
    await catchUp(l)
    const verdict = checkUpdate(l.doc, update, own, suggester)
    if (!verdict.ok) return { refused: verdict.why }
    const seq = await commit(l, update, facts.person.id, clientId, sub)
    return { seq: String(seq) }
  })
  if ("refused" in result) {
    console.warn(`scripts: refused an update on ${id} from ${facts.person.code}: ${result.refused}`)
    return NextResponse.json({ refused: true, why: result.refused }, { status: 409 })
  }
  return NextResponse.json(result)
}
