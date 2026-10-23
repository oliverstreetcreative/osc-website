// POST /api/scripts/<id>/versions/<n>/restore: editors only. The live script becomes what version n said, as one
// change everyone sees arrive (a minimal diff, so untouched words and comment anchors survive), recorded as a NEW
// version; nothing is lost (SPEC §14 phone moment 5, v4 #13).
import { NextResponse } from "next/server"
import { atLeast, roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { catchUp, withLive } from "@/lib/scripts/server/registry"
import { restoreVersion } from "@/lib/scripts/server/versions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: { id: string; n: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly || !atLeast(access.role, "editor")) return NextResponse.json({ error: "Only editors restore versions." }, { status: 403 })
  const n = Number(params.n)
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const v = await withLive(params.id, async (l) => {
    await catchUp(l)
    return restoreVersion(l, n, facts.person.id)
  })
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ n: v.n })
}
