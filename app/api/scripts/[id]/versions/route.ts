// GET /api/scripts/<id>/versions: the history (anyone who can open the script).
// POST {name}: name the current state as a version (editors). SPEC §14 phone moment 5.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { atLeast, roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { withLive, catchUp } from "@/lib/scripts/server/registry"
import { saveVersion, versionNameProblem } from "@/lib/scripts/server/versions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const firstName = (p?: { first_name: string | null; name: string } | null) => (p?.first_name || p?.name || "Someone").trim().split(/\s+/)[0]

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  if (!(await roleOf(params.id, facts))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const versions = await db.scriptVersion.findMany({
    where: { script_id: params.id },
    orderBy: { n: "desc" },
    take: 200,
    select: { n: true, name: true, kind: true, created_at: true, created_by: true, authors: true, total_seconds: true },
  })
  const ids = new Set<string>()
  for (const v of versions) {
    if (v.created_by) ids.add(v.created_by)
    for (const a of (v.authors as string[] | null) ?? []) ids.add(a)
  }
  const people = new Map(
    (await db.person.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, first_name: true } })).map((p) => [p.id, firstName(p)]),
  )
  return NextResponse.json({
    versions: versions.map((v) => ({
      n: v.n,
      name: v.name,
      kind: v.kind,
      at: v.created_at.toISOString(),
      by: v.created_by ? people.get(v.created_by) ?? "Someone" : null,
      authors: [...new Set(((v.authors as string[] | null) ?? []).map((a) => people.get(a) ?? "Someone"))],
      total_seconds: v.total_seconds,
    })),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly || !atLeast(access.role, "editor")) return NextResponse.json({ error: "Only editors name versions." }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const problem = versionNameProblem(name)
  if (problem) return NextResponse.json({ error: problem }, { status: 422 })
  const v = await withLive(params.id, async (l) => {
    await catchUp(l)
    return saveVersion(l, "named", name, facts.person.id)
  })
  return NextResponse.json({ n: v.n })
}
