// Import a script from the importer's output (scripts/import_script.py, "osc-script-import/1"; SPEC §14 v4 #4).
// The client's words exactly as written; every PROMPTER fix a suggestion by the importing staff member. One function
// behind the staff-only POST /api/scripts/import and the STAGING-only pickup of Dropbox import files
// (_admin/client-site/scripts-import/*.json, each an ImportRequest). Idempotent: one script per source file + title.
import { randomUUID } from "crypto"
import * as Y from "yjs"
import { db } from "@/lib/db"
import { importToPM, plainText, pmFromYDoc, renderScript, viewOf, yDocFromJSON, type ScriptImport } from "../doc"
import { personCode } from "../marks"
import { listJson, readText } from "@/lib/client/dropbox"

export type ImportRequest = {
  import: ScriptImport
  script: {
    title?: string
    organization?: string // organization slug
    project?: string // project ext_key
    job?: string
    target_seconds?: number | null
    pace_wpm?: number
    reader?: string
    read_only?: boolean // while the client's own document is the source (v4 #4: Gex)
    canonical?: "dropbox" | "portal" | "gdoc"
  }
  created_by: string // an OSC staff email
  /** STAGING ONLY (the proof): give these people access as the import lands. Production shares through the editor. */
  share?: { email: string; role: "viewer" | "commenter" | "suggester" | "editor"; name?: string }[]
}

const ROLES = new Set(["viewer", "commenter", "suggester", "editor"])

export async function importScript(req: ImportRequest, opts: { allowShare: boolean }): Promise<{ id: string; created: boolean }> {
  const imp = req.import
  if (!imp || imp.format !== "osc-script-import/1" || !Array.isArray(imp.rows) || !imp.source?.sha256) {
    throw new Error("not an osc-script-import/1 file")
  }
  const title = (req.script?.title || imp.title || "").trim()
  if (!title) throw new Error("a script needs a title")
  const creator = await db.person.findFirst({ where: { email: String(req.created_by ?? "").toLowerCase(), is_staff: true } })
  if (!creator) throw new Error("created_by must be an OSC staff member")

  const existing = await db.script.findFirst({ where: { title, source: { path: ["sha256"], equals: imp.source.sha256 } }, select: { id: true } })
  if (existing) {
    if (opts.allowShare && req.share?.length) await applyShares(existing.id, req.share, creator.id)
    return { id: existing.id, created: false }
  }

  let organization_id: string | null = null
  if (req.script?.organization) {
    const org = await db.organization.findUnique({ where: { slug: req.script.organization }, select: { id: true } })
    if (!org) throw new Error(`no organization "${req.script.organization}"`)
    organization_id = org.id
  }
  let project_id: string | null = null
  if (req.script?.project) {
    const project = await db.project.findUnique({ where: { ext_key: req.script.project }, select: { id: true, organization_id: true } })
    if (!project) throw new Error(`no project "${req.script.project}"`)
    if (organization_id && project.organization_id !== organization_id) throw new Error("that project belongs to another organization")
    project_id = project.id
    organization_id ??= project.organization_id
  }

  const ydoc = yDocFromJSON(importToPM(imp, { authorCode: personCode(creator.id), rowId: () => randomUUID() }))
  const update = Y.encodeStateAsUpdate(ydoc)
  const doc = pmFromYDoc(ydoc)
  const target = typeof req.script?.target_seconds === "number" && req.script.target_seconds > 0 ? Math.round(req.script.target_seconds) : null
  const pace = typeof req.script?.pace_wpm === "number" && req.script.pace_wpm >= 80 && req.script.pace_wpm <= 260 ? Math.round(req.script.pace_wpm) : 150
  const render = renderScript(doc, { wpm: pace, target_s: target })

  const id = await db.$transaction(async (tx) => {
    const script = await tx.script.create({
      data: {
        organization_id,
        project_id,
        job: req.script?.job ?? null,
        title,
        target_seconds: target,
        pace_wpm: pace,
        reader: req.script?.reader ?? null,
        canonical: req.script?.canonical ?? "dropbox",
        read_only: req.script?.read_only === true,
        source: { adapter: imp.adapter, path: imp.source.path, sha256: imp.source.sha256, label: imp.source.label },
        created_by: creator.id,
      },
      select: { id: true },
    })
    await tx.scriptClient.create({ data: { script_id: script.id, client_id: BigInt(ydoc.clientID), person_id: creator.id } })
    const row = await tx.scriptUpdate.create({
      data: { script_id: script.id, update: Buffer.from(update), person_id: creator.id, client_id: BigInt(ydoc.clientID) },
      select: { id: true },
    })
    await tx.scriptVersion.create({
      data: {
        script_id: script.id,
        n: 1,
        name: "Imported",
        kind: "import",
        upto_id: row.id,
        state: Buffer.from(update),
        text: plainText(viewOf(doc, "base")),
        rows: render.rows,
        total_seconds: render.total_s,
        authors: [creator.id],
        created_by: creator.id,
      },
    })
    return script.id
  })

  if (opts.allowShare && req.share?.length) await applyShares(id, req.share, creator.id)
  return { id, created: true }
}

/** STAGING (the proof): give each listed OSC-address person access, once; the script becomes client-visible. */
async function applyShares(scriptId: string, share: NonNullable<ImportRequest["share"]>, invitedBy: string) {
  let any = false
  for (const s of share) {
    const email = String(s.email ?? "").trim().toLowerCase()
    if (!/^[^@\s]+@oliverstreetcreative\.com$/.test(email) || !ROLES.has(s.role)) continue // staging: OSC addresses only
    const person =
      (await db.person.findUnique({ where: { email } })) ??
      (await db.person.create({ data: { email, name: s.name?.trim() || email.split("@")[0], role: "CLIENT", is_staff: false } }))
    if (person.is_staff) continue // staff edit everything already
    // Once only, EVER: a share that was revoked stays revoked (the pickup runs every 5 minutes; built review #10).
    const had = await db.scriptAccess.findFirst({ where: { script_id: scriptId, person_id: person.id } })
    if (had) continue
    await db.scriptAccess.create({ data: { script_id: scriptId, person_id: person.id, email, role: s.role, invited_by: invitedBy, accepted_at: new Date() } })
    any = true
  }
  if (any) await db.script.update({ where: { id: scriptId }, data: { audience: "client" } })
}

export const IMPORT_FOLDER = "/_admin/client-site/scripts-import"

/** STAGING: import every request file in the Dropbox import folder that hasn't been imported yet. */
export async function importPendingScripts() {
  const files = await listJson(IMPORT_FOLDER).catch(() => [] as string[])
  for (const f of files) {
    try {
      const req = JSON.parse(await readText(f)) as ImportRequest
      const r = await importScript(req, { allowShare: true })
      if (r.created) console.log(`scripts: imported ${f} → ${r.id}`)
    } catch (err) {
      console.error(`scripts: import of ${f} failed:`, (err as Error).message)
    }
  }
}
