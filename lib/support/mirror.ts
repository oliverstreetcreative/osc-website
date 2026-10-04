// The support mirror (SPEC §29 v2; Sam 10/4 16:25). Server only; runs in the boot loop and right after a report.
//  OUT: each ticket not yet mirrored becomes ONE file, /_admin/client-site/support-<env>/<uuid>.md: the sanitized
//       summary (validated fields; the client's words as one escaped JSON string; lib/support/safety.ts). Never the
//       raw context, never the screenshot (that stays in Postgres for Sam's staff page). Add-only: an existing file is
//       left alone, so a retry can't change what Majordomo already read.
//  IN:  Majordomo's triage answers with status-only files, /_admin/client-site/support-updates-<env>/<uuid>.json,
//       {"status": "open" | "working" | "fixed" | "wont_fix"}. Nothing else in those files counts. A note to the client
//       is never here: notes are client-facing words, so they publish through the gate (a book's support_notes).
import { db } from "@/lib/db"
import { listJsonEntriesAll, readText } from "@/lib/client/dropbox"
import { writeNewFile } from "@/lib/client/dropbox-write"
import { errorCounts, parseStatusUpdate, summaryMarkdown, type Browser, type Device } from "./safety"
import { supportEnv } from "./store"

const ROOT = "/_admin/client-site"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const summaryPath = (env: string, id: string) => `${ROOT}/support-${env}/${id}.md`
export const updatesFolder = (env: string) => `${ROOT}/support-updates-${env}`

let mirroring: Promise<void> | null = null

/** Write the summary of every ticket that hasn't reached Dropbox yet (oldest first). One run at a time. */
export function mirrorTickets(): Promise<void> {
  mirroring ??= mirrorPending().finally(() => {
    mirroring = null
  })
  return mirroring
}

async function mirrorPending() {
  const env = supportEnv()
  const pending = await db.supportTicket.findMany({
    where: { env, mirrored_at: null },
    orderBy: { created_at: "asc" },
    take: 25,
    select: {
      id: true,
      number: true,
      route: true,
      role: true,
      message: true,
      context: true,
      has_screenshot: true,
      created_at: true,
      organization: { select: { slug: true } },
    },
  })
  for (const t of pending) {
    const c = (t.context && typeof t.context === "object" ? t.context : {}) as {
      device?: Device
      browser?: Browser
      viewport?: { w?: number | null; h?: number | null }
    }
    const vp = c.viewport && typeof c.viewport.w === "number" && typeof c.viewport.h === "number" ? { w: c.viewport.w, h: c.viewport.h } : null
    const md = summaryMarkdown({
      id: t.id,
      number: t.number,
      env,
      surface: "portal",
      client: t.organization?.slug ?? null,
      route: t.route,
      role: t.role,
      device: c.device ?? "unknown",
      browser: c.browser ?? "other",
      viewport: vp,
      errors: errorCounts(t.context),
      screenshot: t.has_screenshot,
      created: t.created_at.toISOString(),
      words: t.message,
    })
    const r = await writeNewFile(summaryPath(env, t.id), md)
    if (r !== "written" && r !== "exists") {
      console.error(`support: summary of report #${t.number} didn't reach Dropbox: ${r}`)
      return // Dropbox is down or refusing: the next run tries again, oldest first
    }
    await db.supportTicket.update({ where: { id: t.id }, data: { mirrored_at: new Date() } })
  }
}

// path → the rev already applied. A restart forgets it and re-reads every status file once: cheap, and idempotent.
const applied = new Map<string, string>()

/** Take Majordomo's status files: each sets that ticket's status (this environment's tickets only). */
export async function applyStatusUpdates(): Promise<void> {
  const env = supportEnv()
  const entries = await listJsonEntriesAll(updatesFolder(env))
  if (!entries) return // no listing, or a partial one: change nothing this run
  for (const e of entries) {
    if (applied.get(e.path) === e.rev) continue
    const id = e.path.slice(e.path.lastIndexOf("/") + 1).replace(/\.json$/, "")
    if (!UUID.test(id)) {
      applied.set(e.path, e.rev) // not a ticket's file: ignore it until it changes
      continue
    }
    let raw: string
    try {
      raw = await readText(e.path)
    } catch {
      continue // couldn't read it this time: try again next run
    }
    let status: ReturnType<typeof parseStatusUpdate> = null
    try {
      status = parseStatusUpdate(JSON.parse(raw))
    } catch {
      status = null
    }
    if (status) {
      await db.supportTicket.updateMany({
        where: { id: id.toLowerCase(), env, NOT: { status } },
        data: { status, status_at: new Date() },
      })
    } else {
      console.error(`support: ignoring a status file that isn't {"status": …}: ${e.path}`)
    }
    applied.set(e.path, e.rev)
  }
}
