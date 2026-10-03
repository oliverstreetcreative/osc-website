// POST /api/scripts/import: OSC staff only. Body = an ImportRequest (lib/scripts/server/importer.ts): the importer's
// "osc-script-import/1" output plus where the script belongs. Answers {id, created}. Never shares (that's the editor's
// Share sheet), except on staging where an import may grant the proof's test accounts access.
import { NextResponse } from "next/server"
import { getStaffUser } from "@/lib/portal-auth"
import { IS_STAGING } from "@/lib/site-env"
import { importScript, type ImportRequest } from "@/lib/scripts/server/importer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const staff = await getStaffUser()
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 })
  let body: ImportRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  try {
    const r = await importScript({ ...body, created_by: body.created_by || staff.email }, { allowShare: IS_STAGING })
    return NextResponse.json(r)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }
}
