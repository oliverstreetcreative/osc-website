// GET /api/scripts/<id>/versions/<n>: what version n said (its BASE text and timed rows), for the history view, and
// what changed since the version before it (a word diff from stored versions; v4 #8: never the snapshot view).
// ?compare=<m> diffs against version m instead.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { wordDiff } from "@/lib/scripts/diff"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string; n: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  if (!(await roleOf(params.id, facts))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const n = Number(params.n)
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const v = await db.scriptVersion.findUnique({
    where: { script_id_n: { script_id: params.id, n } },
    select: { n: true, name: true, kind: true, created_at: true, text: true, rows: true, total_seconds: true },
  })
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const asked = Number(new URL(req.url).searchParams.get("compare"))
  const other = await db.scriptVersion.findFirst({
    where: Number.isInteger(asked) && asked > 0 ? { script_id: params.id, n: asked } : { script_id: params.id, n: { lt: n } },
    orderBy: { n: "desc" },
    select: { n: true, text: true },
  })
  return NextResponse.json({
    ...v,
    at: v.created_at.toISOString(),
    compared_to: other?.n ?? null,
    diff: other ? wordDiff(other.text, v.text) : null,
  })
}
