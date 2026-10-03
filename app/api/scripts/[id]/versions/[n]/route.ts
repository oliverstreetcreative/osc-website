// GET /api/scripts/<id>/versions/<n>: what version n said (its BASE text and timed rows), for the history view.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roleOf, sessionFacts } from "@/lib/scripts/server/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string; n: string } }) {
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
  return NextResponse.json({ ...v, at: v.created_at.toISOString() })
}
