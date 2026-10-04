// A cut in review, and its approval of record (SPEC §13 v4). Server only.
//   - Versions come live from Review (review.ts); Review's own numbering ("Version 2 · posted Oct 3").
//   - Approve binds to what Review shows AT THAT MOMENT: the page carries the newest version's id; the approval re-reads
//     Review (no cache) and refuses if a newer version appeared or Review can't be reached.
//   - The record is frozen (VersionApproval) and the ledger file follows (ledger.ts). Staff viewing as a client and
//     staging preview sign-ins never approve (read-only), and only the film's approvers ever see the button.
import type { Prisma } from "@/generated/prisma"
import { db } from "@/lib/db"
import type { ClientContext } from "./context"
import { REVIEW_WHY, reviewVersions, shareToken, type ReviewVersion, type ReviewWhy } from "./review"
import { flagReview, writeLedger } from "./ledger"

type FilmRow = {
  id: string
  ext_key: string | null
  name: string
  review_url: string | null
  review_asset_id: string | null
  approvers: Prisma.JsonValue
  approval: string
  ask: string
  version_label: string | null
  version_review_id: string | null
}

export const filmKeyOf = (extKey: string | null) => extKey?.split("/").pop() ?? null
export const approversOf = (f: Pick<FilmRow, "approvers">) =>
  Array.isArray(f.approvers) ? f.approvers.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase()) : []
export const isApprover = (f: Pick<FilmRow, "approvers">, email: string) => approversOf(f).includes(email.toLowerCase())
/** Sam's label ("v4") belongs to one Review version, named in the book; for any other version there is no label. */
export const labelFor = (f: Pick<FilmRow, "version_label" | "version_review_id">, versionId: string) =>
  f.version_label && f.version_review_id && f.version_review_id.toLowerCase() === versionId.toLowerCase() ? f.version_label : null

export type Approved = { name: string; email: string; at: Date; version_n: number; version_id: string; id: string }
export type ReviewState =
  | { kind: "none" }
  | { kind: "error"; why: ReviewWhy; words: string; approvals: Approved[] }
  | { kind: "ok"; newest: ReviewVersion; versions: ReviewVersion[]; approvals: Approved[]; newestApproved: boolean }

/** Where a film stands in Review, and who has approved what ON THIS ASSET (older assets' approvals stay in Documents). */
export async function reviewState(f: FilmRow, opts: { fresh?: boolean } = {}): Promise<ReviewState> {
  const token = shareToken(f.review_url)
  if (!token || !f.review_asset_id) return { kind: "none" }
  const [rows, r] = await Promise.all([
    db.versionApproval.findMany({
      where: { deliverable_id: f.id, review_asset_id: f.review_asset_id, withdrawn_at: null },
      orderBy: { approved_at: "desc" },
      select: { id: true, name: true, approved_at: true, review_version_n: true, review_version_id: true, email: true },
    }),
    reviewVersions(token, f.review_asset_id, opts),
  ])
  const approvals: Approved[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email.toLowerCase(),
    at: a.approved_at,
    version_n: a.review_version_n,
    version_id: a.review_version_id,
  }))
  if (!r.ok) {
    // v4: a link that stopped working says so to the client and flags Sam; so does an OK he can't get through a
    // password. Never awaited: a slow Dropbox mustn't hold the page.
    if (r.why === "gone") flagReview("review-link-ended", f.ext_key ?? f.id, f.name)
    if (r.why === "locked" && f.ask === "ok") flagReview("ok-on-locked-link", f.ext_key ?? f.id, f.name)
    return { kind: "error", why: r.why, words: REVIEW_WHY[r.why], approvals }
  }
  const newest = r.versions[0]
  return { kind: "ok", newest, versions: r.versions, approvals, newestApproved: complete(f, approvals, newest.id) }
}

/** Is `versionId` approved under the film's rule (any one approver, or every approver)? */
function complete(f: FilmRow, approvals: Approved[], versionId: string) {
  const done = new Set(approvals.filter((a) => a.version_id === versionId).map((a) => a.email))
  if (!done.size) return false
  if (f.approval !== "all") return true
  const list = approversOf(f)
  return list.length > 0 && list.every((e) => done.has(e))
}

export type ApproveResult = { ok: true; approvalId: string } | { ok: false; why: string; code: ApproveCode; at?: string }
export type ApproveCode =
  | "viewing"
  | "preview"
  | "missing"
  | "not-approver"
  | "not-asking"
  | "unreachable"
  | "locked"
  | "gone"
  | "processing"
  | "newer"
  | "changed"

/** The page's words for a refusal code (a redirect carries only the code, never text). */
export const APPROVE_WORDS: Record<ApproveCode, string> = {
  viewing: "Read-only while viewing as the client.",
  preview: "This is a preview sign-in: it can look, not approve.",
  missing: "That film isn't here.",
  "not-approver": "Only the film's approvers can approve it.",
  "not-asking": "Sam isn't asking for an OK on this film right now.",
  unreachable: REVIEW_WHY.unreachable,
  locked: "This cut's link has a password, so it can't be approved here. Text Sam.",
  gone: REVIEW_WHY.gone,
  processing: REVIEW_WHY.processing,
  newer: "A newer cut was posted. Watch it first.",
  changed: "This cut changed in Review. Watch the current version first.",
}
export const isApproveCode = (s: string | undefined): s is ApproveCode => !!s && Object.hasOwn(APPROVE_WORDS, s)
const refuse = (code: ApproveCode, at?: string): ApproveResult => ({ ok: false, code, why: APPROVE_WORDS[code], at })

/** The approval itself (POST). Re-reads Review with no cache; refuses a stale page. */
export async function approveVersion(
  ctx: ClientContext,
  filmId: string,
  versionId: string,
  /** The version number the page showed (to tell "a newer cut" from "that cut was taken down"). */
  shownN: number | null,
  note: string | null,
  meta: { ip: string | null; userAgent: string | null; preview: boolean },
): Promise<ApproveResult> {
  if (ctx.viewing) return refuse("viewing")
  if (meta.preview) return refuse("preview")
  // Any org the person belongs to (the approve page finds the project the same way), recorded with THAT org's role.
  const film = await db.deliverable.findFirst({
    where: { id: filmId, hidden: false, project: { organization_id: { in: ctx.orgs.map((o) => o.id) }, hidden: false } },
    include: { project: { select: { job_number: true, organization_id: true } } },
  })
  const orgId = film?.project.organization_id
  const org = orgId ? ctx.orgs.find((o) => o.id === orgId) : undefined
  const member = orgId
    ? await db.membership.findFirst({ where: { person_id: ctx.user.id, organization_id: orgId, hidden: false }, select: { role: true } })
    : null
  if (!film || !org || !member) return refuse("missing")
  if (!isApprover(film, ctx.user.email)) return refuse("not-approver")
  if (film.ask !== "ok" || film.delivered_at) return refuse("not-asking")
  const token = shareToken(film.review_url)
  if (!token || !film.review_asset_id) return refuse("gone")
  const r = await reviewVersions(token, film.review_asset_id, { fresh: true })
  if (!r.ok) return refuse(r.why)
  const newest = r.versions[0]
  if (newest.id !== versionId) {
    if (shownN !== null && newest.n <= shownN) return refuse("changed")
    const when = newest.posted_at
      ? new Date(newest.posted_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
      : undefined
    return refuse("newer", when)
  }
  const key = { deliverable_id: film.id, review_version_id: newest.id, person_id: ctx.user.id }
  const existing = await db.versionApproval.findUnique({ where: { deliverable_id_review_version_id_person_id: key }, select: { id: true } })
  if (existing) return { ok: true, approvalId: existing.id }
  const created = await db.versionApproval
    .create({
      data: {
        deliverable_id: film.id,
        organization_id: org.id,
        job: film.project.job_number,
        film_key: filmKeyOf(film.ext_key) ?? film.id,
        film_title: film.name,
        review_asset_id: film.review_asset_id,
        review_version_id: newest.id,
        review_version_n: newest.n,
        review_posted_at: newest.posted_at ? new Date(newest.posted_at) : null,
        version_label: labelFor(film, newest.id),
        person_id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email.toLowerCase(),
        org_name: org.name,
        member_role: member.role,
        note: note?.trim().slice(0, 1000) || null,
        how: "portal",
        ip: meta.ip,
        user_agent: meta.userAgent?.slice(0, 300) ?? null,
      },
      select: { id: true },
    })
    // A double tap: the other request wrote the same approval first (unique per film + version + person).
    .catch(async (err) => {
      const again = await db.versionApproval.findUnique({ where: { deliverable_id_review_version_id_person_id: key }, select: { id: true } })
      if (again) return again
      throw err
    })
  await writeLedger(created.id).catch((err) => console.error("approvals: ledger write failed", err))
  return { ok: true, approvalId: created.id }
}

/** The client's address as our proxy saw it: the LAST X-Forwarded-For hop (lib/client/ip.ts). */
export { clientIp } from "./ip"
