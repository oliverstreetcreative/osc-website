// Version history (SPEC §14 phone moment 5; v4 #8, #13). Server only.
//   auto     after 10 minutes of activity since the last version (checked as updates commit)
//   named    on demand ("Mike's edits"); internal markers refused in names
//   restore  a NEW version made from an old one; the live document gets a MINIMAL diff (y-tiptap's updateYFragment),
//            not a replace-all, so comment anchors and untouched words survive
// History diffs are computed from stored versions on the server, never y-prosemirror's snapshot view (v4 #8: gc on).
import * as Y from "yjs"
import { db } from "@/lib/db"
import { plainText, pmFromYDoc, renderScript, viewOf } from "../doc"
import { restoreUpdate } from "../restore"
import { commit, type Live } from "./registry"

const AUTO_EVERY_MS = 10 * 60 * 1000
const INTERNAL = /🤖|PRELIM|HANDOFF|INTERNAL|DRAFT ONLY|DO NOT SHARE/i

export function versionNameProblem(name: string): string | null {
  const n = name.trim()
  if (!n) return "Give the version a name."
  if (n.length > 80) return "Keep the name under 80 characters."
  if (INTERNAL.test(n)) return "That name has an internal marker in it."
  return null
}

async function nextN(scriptId: string) {
  const last = await db.scriptVersion.findFirst({ where: { script_id: scriptId }, orderBy: { n: "desc" }, select: { n: true } })
  return (last?.n ?? 0) + 1
}

/** A version of the live document as it stands. Call inside withLive (the state then matches `upto`). */
export async function saveVersion(l: Live, kind: "auto" | "named" | "restore" | "approved" | "shoot", name: string | null, by: string | null) {
  const script = await db.script.findUnique({ where: { id: l.id }, select: { pace_wpm: true, target_seconds: true } })
  const prev = await db.scriptVersion.findFirst({ where: { script_id: l.id }, orderBy: { n: "desc" }, select: { upto_id: true } })
  const authors = await db.scriptUpdate.findMany({
    where: { script_id: l.id, id: { gt: prev?.upto_id ?? BigInt(0), lte: l.upto } },
    select: { person_id: true },
    distinct: ["person_id"],
  })
  const doc = pmFromYDoc(l.doc)
  const render = renderScript(doc, { wpm: script?.pace_wpm ?? 150, target_s: script?.target_seconds ?? null })
  return db.scriptVersion.create({
    data: {
      script_id: l.id,
      n: await nextN(l.id),
      name,
      kind,
      upto_id: l.upto,
      state: Buffer.from(Y.encodeStateAsUpdate(l.doc)),
      text: plainText(viewOf(doc, "base")),
      rows: render.rows,
      total_seconds: render.total_s,
      authors: authors.map((a) => a.person_id),
      created_by: by,
    },
    select: { n: true },
  })
}

/** Autosave: after an update commits, if the last version is 10 minutes old and something changed since. */
export async function maybeAutosave(l: Live) {
  const last = await db.scriptVersion.findFirst({ where: { script_id: l.id }, orderBy: { n: "desc" }, select: { created_at: true, upto_id: true } })
  if (last && (last.upto_id >= l.upto || Date.now() - last.created_at.getTime() < AUTO_EVERY_MS)) return
  await saveVersion(l, "auto", null, null)
}

/**
 * Restore version n: the live document becomes what it said then, as ONE change by `personId`, through a minimal diff;
 * then a "restore" version records it. Call inside withLive.
 */
export async function restoreVersion(l: Live, n: number, personId: string) {
  const v = await db.scriptVersion.findUnique({ where: { script_id_n: { script_id: l.id, n } }, select: { state: true, n: true } })
  if (!v) return null
  // the server's own Yjs session makes the change; the update row records who asked for it
  const { update, clientId } = restoreUpdate(l.doc, new Uint8Array(v.state))
  await commit(l, update, personId, clientId)
  return saveVersion(l, "restore", `Restored version ${v.n}`, personId)
}
