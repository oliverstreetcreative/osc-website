// The approvals ledger (SPEC §13 v3/v4): one JSON file per approval in Dropbox, which the publish gate's lock reads
// (scripts/client_gate.py approved_job_versions: {job, film, n}) and Majordomo sees. Written after the database row,
// retried on every client-site run until it lands. STAGING writes its own folder: a rehearsal approval must never lock
// a real client's version. Server only.
import { db } from "@/lib/db"
import { IS_PRODUCTION } from "@/lib/site-env"
import { writeNewFile } from "./dropbox-write"

const FOLDER = IS_PRODUCTION ? "/_admin/client-site/ledger/approvals" : "/_admin/client-site/ledger/approvals-staging"
const FLAGS = IS_PRODUCTION ? "/_admin/client-site/ledger/flags" : "/_admin/client-site/ledger/flags-staging"
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "x"
const eastern = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " Eastern"

export async function writeLedger(approvalId: string): Promise<boolean> {
  const a = await db.versionApproval.findUnique({
    where: { id: approvalId },
    include: { deliverable: { select: { approval: true, approvers: true } } },
  })
  if (!a || a.ledger_written_at) return !!a
  // Named by the approval's own id: a retry lands on the same name, and no other approval can ever share it (a
  // re-uploaded asset restarts Review's numbering; two projects without a job number may share a film key).
  const path = `${FOLDER}/${safe(a.job ?? "no-job")}_${safe(a.film_key)}_${a.review_version_n}_${a.id}.json`
  const record = {
    job: a.job,
    film: a.film_key,
    n: a.review_version_n,
    film_title: a.film_title,
    version_label: a.version_label,
    review: { asset_id: a.review_asset_id, version_id: a.review_version_id, version_number: a.review_version_n, posted_at: a.review_posted_at },
    approved_by: { name: a.name, email: a.email, org: a.org_name, role: a.member_role },
    approved_at: a.approved_at.toISOString(),
    approved_at_eastern: eastern(a.approved_at),
    // The film's rule when this was written: any one approver, or every one of them.
    approval_rule: a.deliverable.approval,
    approvers: Array.isArray(a.deliverable.approvers) ? a.deliverable.approvers : [],
    note: a.note,
    how: a.how,
    portal_record: a.id,
  }
  const r = await writeNewFile(path, JSON.stringify(record, null, 2) + "\n")
  if (r !== "written" && r !== "exists") {
    console.error(`approvals: ledger write failed for ${a.id}: ${r}`)
    return false
  }
  await db.versionApproval.update({ where: { id: a.id }, data: { ledger_path: path, ledger_written_at: new Date() } })
  return true
}

/** Every approval whose ledger file hasn't landed yet (the client-site run calls this every 5 minutes). */
export async function writePendingLedgers() {
  const pending = await db.versionApproval.findMany({ where: { ledger_written_at: null }, select: { id: true }, take: 50 })
  for (const p of pending) await writeLedger(p.id).catch((err) => console.error("approvals: ledger retry failed", err))
}

/** What the flags folder tells Sam (§13 v4 "flags Sam"); Majordomo turns each file into a ticket. */
export const FLAG_WORDS = {
  "review-link-ended": "The portal can't read this cut's Review link: it was disabled, expired, or the book's asset id is wrong.",
  "ok-on-locked-link": "The book asks for the client's OK, but the Review link has a password or needs a login, so the portal can't take an approval.",
} as const
export type FlagKind = keyof typeof FLAG_WORDS

const tried = new Set<string>()

/**
 * Drop one add-only flag file per kind, film and Eastern day. Never awaited by a page: it runs after the response,
 * is attempted once per process per day (a failing Dropbox isn't retried on every render), and logs failures.
 */
export function flagReview(kind: FlagKind, film: string, title: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  const name = `${kind}_${safe(film)}_${today}.json`
  if (tried.has(name)) return
  tried.add(name)
  const body = { what: FLAG_WORDS[kind], kind, film, film_title: title, seen_at: new Date().toISOString() }
  void writeNewFile(`${FLAGS}/${name}`, JSON.stringify(body, null, 2) + "\n")
    .then((r) => {
      if (r !== "written" && r !== "exists") console.error(`review: flag write failed for ${film}: ${r}`)
    })
    .catch((err) => console.error("review: flag write failed", err))
}
