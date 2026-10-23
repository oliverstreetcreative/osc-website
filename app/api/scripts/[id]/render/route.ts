// GET /api/scripts/<id>/render with `X-Script-Key: <key id>.<secret>`: the script as the shoot-day hub reads it,
// server to server (SPEC §14 v4 #9; proposal client-website-20261003-0920-hub-contract).
// The version Sam marked for the shoot (`shoot_version`) when there is one; otherwise the shoot date's FIRST fetch is
// frozen as a version ("as of 9:02 · changed since"), so words never change mid-take. The text never includes pending
// suggestions (`pending_suggestions` says how many were left out). Timing comes from the portal's one timing module.
import { NextResponse } from "next/server"
import * as Y from "yjs"
import { db } from "@/lib/db"
import { verifyHubKey } from "@/lib/scripts/server/hubkey"
import { catchUp, withLive } from "@/lib/scripts/server/registry"
import { saveVersion } from "@/lib/scripts/server/versions"
import { pmFromYDoc, renderScript } from "@/lib/scripts/doc"
import { UUID } from "@/lib/scripts/server/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const date = verifyHubKey(id, req.headers.get("x-script-key"))
  if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const script = await db.script.findUnique({
    where: { id },
    select: { title: true, archived_at: true, shoot_version: true, pace_wpm: true, target_seconds: true },
  })
  if (!script || script.archived_at) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const dayName = `Shoot ${date}`
  const version = await withLive(id, async (l) => {
    await catchUp(l)
    if (script.shoot_version) {
      const v = await db.scriptVersion.findUnique({ where: { script_id_n: { script_id: id, n: script.shoot_version } } })
      if (v) return { v, live: l.upto }
    }
    let v = await db.scriptVersion.findFirst({ where: { script_id: id, kind: "shoot", name: dayName }, orderBy: { n: "asc" } })
    if (!v) {
      const made = await saveVersion(l, "shoot", dayName, null)
      v = await db.scriptVersion.findUnique({ where: { script_id_n: { script_id: id, n: made.n } } })
    }
    return { v: v!, live: l.upto }
  })

  const doc = new Y.Doc({ gc: true })
  Y.applyUpdate(doc, new Uint8Array(version.v.state))
  const r = renderScript(pmFromYDoc(doc), { wpm: script.pace_wpm, target_s: script.target_seconds })
  return NextResponse.json(
    {
      title: script.title,
      version: {
        n: version.v.n,
        name: version.v.name,
        as_of: version.v.created_at.toISOString(),
        marked_for_shoot: script.shoot_version === version.v.n,
        changed_since: version.live > version.v.upto_id,
      },
      rows: r.rows.map((row) => ({ video: row.video, speaker: row.speaker, audio: row.audio, directions: row.directions, seconds: row.seconds })),
      total_s: r.total_s,
      target_s: r.target_s,
      label: r.label,
      pace_wpm: r.pace_wpm,
      pending_suggestions: r.pending_suggestions,
      prompter_text: r.prompter_text,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
