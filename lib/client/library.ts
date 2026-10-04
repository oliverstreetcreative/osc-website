// Footage from Stacks (SPEC §23 v2). Server only.
//   Sync: published/library/<org>/<key>.json (written only by scripts/client_gate.py on Sam's tap) → Library +
//   LibraryClip. Preview orgs read preview/library/<org>--preview/. A closed schema again here (defence in depth: the
//   gate already refused anything else), unchanged packages skipped by Dropbox rev, removed ones hidden, never deleted.
//   Hearts: append-only rows; the latest row per person and clip is the current state.
import { db } from "@/lib/db"
import { listJsonEntries, readText } from "./dropbox"
import { Package, dayRange, clipLength } from "./library-shape"

export { Package, dayRange, clipLength }

export const LIBRARY_FOLDER = "/_admin/client-site/published/library"
export const LIBRARY_PREVIEW_FOLDER = "/_admin/client-site/preview/library"

const day = (s?: string) => (s ? new Date(`${s}T12:00:00Z`) : null)
const CHUNK = 100

/** Sync one org's footage. Returns problems for the sync report (never throws for one bad package). */
export async function syncLibraries(slug: string, preview: boolean): Promise<string[]> {
  const org = await db.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org) return []
  const folder = `${preview ? LIBRARY_PREVIEW_FOLDER : LIBRARY_FOLDER}/${slug}`
  const entries = await listJsonEntries(folder)
  if (entries === null) return [`${folder}: couldn't list (nothing hidden)`]
  const problems: string[] = []
  const keep: string[] = []
  for (const e of entries) {
    const key = e.path.split("/").pop()!.replace(/\.json$/, "")
    const ext = `${slug}/${key}`
    keep.push(ext)
    const existing = await db.library.findUnique({ where: { ext_key: ext }, select: { id: true, source_rev: true, hidden: true } })
    if (existing && e.rev && existing.source_rev === e.rev && !existing.hidden) continue
    let raw: string
    try {
      raw = await readText(e.path)
    } catch (err) {
      // Couldn't READ it (Dropbox hiccup): leave the library as it was and try again next run.
      problems.push(`${e.path}: ${String((err as Error)?.message ?? err).slice(0, 300)}`)
      continue
    }
    try {
      const pkg = Package.parse(JSON.parse(raw))
      if (pkg.key !== key) throw new Error(`key ${pkg.key} isn't the file name`)
      if (pkg.org !== slug) throw new Error(`names org ${pkg.org}`)
      const project = await db.project.findUnique({ where: { ext_key: `${slug}/${pkg.project}` }, select: { id: true, job_number: true } })
      if (!project) throw new Error(`project ${pkg.project} isn't on the site`)
      if (project.job_number !== pkg.job) throw new Error(`job ${pkg.job} isn't the project's`)
      const days = pkg.clips.map((c) => c.taken_on).filter((x): x is string => !!x).sort()
      const keepClips = pkg.clips.map((c) => `${ext}/${c.key}`)
      const data = {
        organization_id: org.id,
        project_id: project.id,
        title: pkg.title,
        description: pkg.description ?? null,
        job: pkg.job,
        clip_count: pkg.clips.length,
        first_day: day(days[0]),
        last_day: day(days[days.length - 1]),
        source_rev: null, // marked done only at the very end: a failure part-way is retried next run
        hidden: false,
        synced_at: new Date(),
      }
      const lib = await db.library.upsert({ where: { ext_key: ext }, create: { ext_key: ext, ...data }, update: data, select: { id: true } })
      // Removals FIRST: a clip that left the snapshot never outlives a failure further down.
      await db.libraryClip.updateMany({ where: { library_id: lib.id, ext_key: { notIn: keepClips }, hidden: false }, data: { hidden: true } })
      for (let i = 0; i < pkg.clips.length; i += CHUNK) {
        await db.$transaction(
          pkg.clips.slice(i, i + CHUNK).map((c, j) => {
            const cx = `${ext}/${c.key}`
            const cd = {
              library_id: lib.id,
              clip_key: c.key,
              sam_event: c.sam_event,
              title: c.title,
              taken_on: day(c.taken_on),
              fps: c.fps,
              mux_playback_id: c.mux_playback_id,
              duration_s: c.duration_s,
              thumb_s: c.thumb_s ?? null,
              aspect: c.aspect ?? null,
              sort: i + j,
              hidden: false,
            }
            return db.libraryClip.upsert({ where: { ext_key: cx }, create: { ext_key: cx, ...cd }, update: cd })
          }),
        )
      }
      await db.library.update({ where: { id: lib.id }, data: { source_rev: e.rev || null } })
    } catch (err) {
      problems.push(`${e.path}: ${String((err as Error)?.message ?? err).slice(0, 300)}`)
      // A changed snapshot that won't apply: fail closed, hide the library until one does.
      if (existing) await db.library.update({ where: { id: existing.id }, data: { hidden: true, source_rev: null } }).catch(() => {})
    }
  }
  // Gone from the folder (and the listing worked) → hidden.
  await db.library.updateMany({ where: { organization_id: org.id, ext_key: { notIn: keep }, hidden: false }, data: { hidden: true } })
  return problems
}

/**
 * A library the signed-in person may see: its org is one of theirs, and neither it nor its project is hidden. The
 * URL's project slug must match too, so a library id can't be read under another project's address.
 */
export async function findLibrary(orgIds: string[], projectSlug: string, libraryId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(libraryId)) return null
  return db.library.findFirst({
    where: { id: libraryId, hidden: false, organization_id: { in: orgIds }, project: { slug: projectSlug, hidden: false } },
    include: { project: { select: { id: true, name: true, slug: true, organization: { select: { slug: true } } } } },
  })
}

/** A person's current hearts among `clipIds` (append-only rows: the latest one per clip wins). */
export async function heartsOf(personId: string, clipIds: string[]): Promise<Set<string>> {
  if (!clipIds.length) return new Set()
  const rows = await db.libraryHeart.findMany({
    where: { person_id: personId, clip_id: { in: clipIds } },
    orderBy: { seq: "desc" },
    select: { clip_id: true, favorite: true },
  })
  const seen = new Set<string>()
  const on = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.clip_id)) continue
    seen.add(r.clip_id)
    if (r.favorite) on.add(r.clip_id)
  }
  return on
}

/** Every clip id this person has hearted in a library (for the "Your favorites" chip). */
export async function heartedInLibrary(personId: string, libraryId: string): Promise<Set<string>> {
  const ids = await db.libraryClip.findMany({ where: { library_id: libraryId, hidden: false }, select: { id: true } })
  return heartsOf(
    personId,
    ids.map((c) => c.id),
  )
}
