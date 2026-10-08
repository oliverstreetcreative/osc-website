// POST /api/scripts/<id>/hub-key {date: "YYYY-MM-DD"}: OSC staff only. The key the shoot-day hub sends in
// `X-Script-Key` to read this script on that shoot date (SPEC §14 v4 #9). Answers 503 until SCRIPT_HUB_SECRET is set.
import { NextResponse } from "next/server"
import { getStaffUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { UUID } from "@/lib/scripts/server/access"
import { hubKeysOn, mintHubKey } from "@/lib/scripts/server/hubkey"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const staff = await getStaffUser()
  if (!staff || !UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!hubKeysOn()) return NextResponse.json({ error: "Hub keys are off: SCRIPT_HUB_SECRET isn't set." }, { status: 503 })
  const script = await db.script.findUnique({ where: { id: params.id }, select: { archived_at: true } })
  if (!script || script.archived_at) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = (await req.json().catch(() => ({}))) as { date?: unknown }
  const date = typeof body.date === "string" ? body.date : ""
  const key = mintHubKey(params.id, date)
  if (!key) return NextResponse.json({ error: "A shoot date like 2026-10-07, please." }, { status: 422 })
  return NextResponse.json({ key, header: "X-Script-Key", date })
}
