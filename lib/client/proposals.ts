// A proposal the client accepts (SPEC §24 v2). Server only.
//   Accept is the old portal's doctrine (osc-portal SKILL): a plain tap records a yes to the EXACT PDF served — who,
//   when, from what IP, its sha256 — builds nothing, and tells Sam (the ledger, which Majordomo reads; the gate won't
//   publish an `ask: accept` until that reader exists). No typed name, no signature, no promised agreement step.
//   The PDF is served ONLY from the gate's frozen copy (_admin/client-site/frozen/<sha256>.pdf), hashed as it's read.
import { createHash } from "crypto"
import { db } from "@/lib/db"
import type { ClientContext } from "./context"
import { download } from "./dropbox"
import { writeAcceptanceLedger } from "./ledger"
import { seesMoney } from "./money"

export const FROZEN = "/_admin/client-site/frozen"
const SHA = /^[0-9a-f]{64}$/

/** VIEWERs see no money (SPEC §10.5b); a proposal is billing-scope (§0.2). Staff viewing see what the client sees.
 *  The same rule as every other money surface (lib/client/money.ts seesMoney, SPEC §28 v2). */
export const seesProposals = (role: string) => seesMoney(role)

/** The frozen bytes of a proposal, verified against the hash the gate froze; null when missing or different. */
export async function frozenPdf(sha256: string | null | undefined): Promise<Uint8Array | null> {
  if (!sha256 || !SHA.test(sha256)) return null
  const res = await download(`${FROZEN}/${sha256}.pdf`)
  if (!res) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  return createHash("sha256").update(buf).digest("hex") === sha256 ? buf : null
}

/** Today in Eastern time as YYYY-MM-DD (a date string, never a fixed offset: DST ends Nov 1). */
export const todayEastern = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
/** A date-only fact (stored at UTC noon) as YYYY-MM-DD. */
export const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
export const expired = (goodUntil: Date | null | undefined) => {
  const g = isoDay(goodUntil)
  return !!g && g < todayEastern()
}

export const acceptorsOf = (doc: { acceptors: unknown }) =>
  Array.isArray(doc.acceptors) ? doc.acceptors.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase()) : []
export const isAcceptor = (doc: { acceptors: unknown }, email: string) => acceptorsOf(doc).includes(email.toLowerCase())

/** The person's role in a given org (staff viewing: STAFF). */
export async function roleIn(ctx: ClientContext, orgId: string): Promise<string | null> {
  if (ctx.viewing) return ctx.org.id === orgId ? "STAFF" : null
  const m = await db.membership.findFirst({ where: { person_id: ctx.user.id, organization_id: orgId, hidden: false }, select: { role: true } })
  return m?.role ?? null
}

/** A proposal this person may open (any of their orgs, not hidden, its project not hidden, and a role that sees money). */
export async function findProposal(ctx: ClientContext, id: string, opts: { evenHidden?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const doc = await db.document.findFirst({
    where: { id, kind: "proposal", organization_id: { in: ctx.orgs.map((o) => o.id) }, ...(opts.evenHidden ? {} : { hidden: false }) },
    include: { project: { select: { name: true, slug: true, hidden: true, job_number: true } }, acceptance: true },
  })
  if (!doc || (!opts.evenHidden && doc.project?.hidden)) return null
  const role = await roleIn(ctx, doc.organization_id)
  if (!role || !seesProposals(role)) return null
  return { doc, role }
}

export type AcceptCode = "viewing" | "preview" | "missing" | "not-acceptor" | "not-asking" | "expired" | "changed" | "unavailable" | "taken"
export const ACCEPT_WORDS: Record<AcceptCode, string> = {
  viewing: "Read-only while viewing as the client.",
  preview: "This is a preview sign-in: it can look, not accept.",
  missing: "That proposal isn't here.",
  "not-acceptor": "Only the people Sam named can accept this proposal.",
  "not-asking": "This proposal isn't open for acceptance.",
  expired: "This proposal has expired. Text Sam.",
  changed: "Sam updated this proposal. Read the new one first.",
  unavailable: "The proposal file isn't available right now. Try again in a minute.",
  taken: "This proposal has already been accepted.",
}
export const isAcceptCode = (s: string | undefined): s is AcceptCode => !!s && Object.hasOwn(ACCEPT_WORDS, s)

export type AcceptResult = { ok: true; id: string } | { ok: false; code: AcceptCode }

/** The Accept itself (POST). The page carried the sha256 it rendered; the frozen file is re-hashed right now. */
export async function acceptProposal(
  ctx: ClientContext,
  documentId: string,
  shownSha: string,
  meta: { ip: string | null; userAgent: string | null; preview: boolean },
): Promise<AcceptResult> {
  if (ctx.viewing) return { ok: false, code: "viewing" }
  if (meta.preview) return { ok: false, code: "preview" }
  const found = await findProposal(ctx, documentId)
  if (!found) return { ok: false, code: "missing" }
  const { doc, role } = found
  if (!isAcceptor(doc, ctx.user.email)) return { ok: false, code: "not-acceptor" }
  if (doc.acceptance) return doc.acceptance.person_id === ctx.user.id ? { ok: true, id: doc.acceptance.id } : { ok: false, code: "taken" }
  if (doc.ask !== "accept" || !doc.sha256) return { ok: false, code: "not-asking" }
  if (expired(doc.good_until)) return { ok: false, code: "expired" }
  if (doc.sha256 !== shownSha) return { ok: false, code: "changed" }
  if (!(await frozenPdf(doc.sha256))) return { ok: false, code: "unavailable" }
  const org = ctx.orgs.find((o) => o.id === doc.organization_id)!
  const created = await db.proposalAcceptance
    .create({
      data: {
        document_id: doc.id,
        organization_id: doc.organization_id,
        project_id: doc.project_id,
        job: doc.project?.job_number ?? null,
        doc_key: doc.ext_key.split("/").pop() ?? doc.ext_key,
        title: doc.title,
        sha256: doc.sha256,
        total: doc.total,
        good_until: doc.good_until,
        person_id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email.toLowerCase(),
        org_name: org.name,
        org_slug: org.slug,
        member_role: role,
        ip: meta.ip,
        user_agent: meta.userAgent?.slice(0, 300) ?? null,
      },
      select: { id: true, person_id: true },
    })
    // A double tap (or two acceptors at once): ONE acceptance per document; the first one stands.
    .catch(async (err) => {
      const again = await db.proposalAcceptance.findUnique({ where: { document_id: doc.id }, select: { id: true, person_id: true } })
      if (again) return again
      throw err
    })
  if (created.person_id !== ctx.user.id) return { ok: false, code: "taken" }
  await writeAcceptanceLedger(created.id).catch((err) => console.error("proposals: ledger write failed", err))
  return { ok: true, id: created.id }
}
