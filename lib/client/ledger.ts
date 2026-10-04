// The approvals ledger (SPEC §13 v3/v4): one JSON file per approval in Dropbox, which the publish gate's lock reads
// (scripts/client_gate.py approved_job_versions: {job, film, n}) and Majordomo sees. Written after the database row,
// retried on every client-site run until it lands. STAGING writes its own folder: a rehearsal approval must never lock
// a real client's version. Server only.
import { db } from "@/lib/db"
import { IS_PRODUCTION } from "@/lib/site-env"
import { writeNewFile } from "./dropbox-write"

const FOLDER = IS_PRODUCTION ? "/_admin/client-site/ledger/approvals" : "/_admin/client-site/ledger/approvals-staging"
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "x"

export async function writeLedger(approvalId: string): Promise<boolean> {
  const a = await db.versionApproval.findUnique({ where: { id: approvalId } })
  if (!a || a.ledger_written_at) return !!a
  const path = `${FOLDER}/${safe(a.job ?? "no-job")}_${safe(a.film_key)}_${a.review_version_n}_${a.person_id.slice(0, 8)}.json`
  const record = {
    job: a.job,
    film: a.film_key,
    n: a.review_version_n,
    film_title: a.film_title,
    version_label: a.version_label,
    review: { asset_id: a.review_asset_id, version_id: a.review_version_id, version_number: a.review_version_n, posted_at: a.review_posted_at },
    approved_by: { name: a.name, email: a.email, org: a.org_name, role: a.member_role },
    approved_at: a.approved_at.toISOString(),
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

const FLAGS = IS_PRODUCTION ? "/_admin/client-site/ledger/flags" : "/_admin/client-site/ledger/flags-staging"
const flagged = new Set<string>()

/** A Review link that has ended (§13 v4 "flags Sam"): one add-only file per film per Eastern day; Majordomo reads it. */
export async function flagLinkEnded(film: string, title: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  const name = `review-link-ended_${safe(film)}_${today}.json`
  if (flagged.has(name)) return
  const body = { what: "A client opened a cut whose Review link has ended or can't be read.", film, film_title: title, seen_at: new Date().toISOString() }
  const r = await writeNewFile(`${FLAGS}/${name}`, JSON.stringify(body, null, 2) + "\n")
  if (r === "written" || r === "exists") flagged.add(name)
  else console.error(`review: flag write failed for ${film}: ${r}`)
}

/** Every approval whose ledger file hasn't landed yet (the client-site run calls this every 5 minutes). */
export async function writePendingLedgers() {
  const pending = await db.versionApproval.findMany({ where: { ledger_written_at: null }, select: { id: true }, take: 50 })
  for (const p of pending) await writeLedger(p.id).catch((err) => console.error("approvals: ledger retry failed", err))
}
