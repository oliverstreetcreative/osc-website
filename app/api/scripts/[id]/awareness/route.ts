// POST /api/scripts/<id>/awareness {update (base64)}: who's here and where their cursor is (SPEC §14 Spike A).
// Never stored. The server is the authority on NAMES: whatever a browser says, the name shown on its cursor is the
// signed-in person's (v4 #11: never an email), and only clientIDs bound to them may speak. Throttled per person.
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { bindClients, roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { b64, broadcast, decodeAwareness, encodeAwareness, fromB64, openLive, rememberPresence } from "@/lib/scripts/server/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const last = new Map<string, number[]>() // person+script → recent send times
const COLORS = ["#d9480f", "#1971c2", "#2f9e44", "#ae3ec9", "#e8590c", "#0c8599", "#c2255c", "#5f3dc4"]

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const key = `${facts.person.id}:${id}`
  const now = Date.now()
  const recent = (last.get(key) ?? []).filter((t) => now - t < 1000)
  if (recent.length >= 4) return NextResponse.json({ ok: true, throttled: true })
  recent.push(now)
  last.set(key, recent)

  let body: { update?: unknown; sub?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  if (typeof body.update !== "string" || body.update.length > 20_000) return NextResponse.json({ error: "Bad request" }, { status: 400 })
  const entries = decodeAwareness(fromB64(body.update))
  if (!entries?.length) return NextResponse.json({ error: "Bad request" }, { status: 400 })
  const own = await bindClients(id, facts.person.id, entries.map((e) => e.client))
  if (!own) return NextResponse.json({ error: "Not your session" }, { status: 403 })

  const color = COLORS[parseInt(facts.person.code.slice(0, 2), 16) % COLORS.length]
  const firstName = (facts.person.name || "Someone").trim().split(/\s+/)[0]
  const fixed = entries.map((e) => ({
    ...e,
    state: e.state ? { ...e.state, user: { code: facts.person.code, name: firstName, color, role: access.role } } : null,
  }))
  const update = encodeAwareness(fixed)
  const live = await openLive(id)
  for (const e of fixed) rememberPresence(live, e.client, encodeAwareness([e]), facts.person.id, e.state === null)
  broadcast(live, "awareness", { update: b64(update) }, typeof body.sub === "string" ? body.sub : undefined)
  return NextResponse.json({ ok: true })
}
