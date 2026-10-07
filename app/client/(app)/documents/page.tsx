import Link from "next/link"
import { BadgeCheck, ChevronRight, Search } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgDocuments, visibleScriptsWhere } from "@/lib/client/data"
import { DOC_KIND_LABEL } from "@/lib/client/format"
import { DocRow, HelpFooter } from "@/app/client/ui"
import { db } from "@/lib/db"
import { seesProposals } from "@/lib/client/proposals"
import { MONEY_DOC_KINDS } from "@/lib/client/money"

export const metadata = { title: "Documents" }

const APPROVAL = "approval"
const ACCEPTANCE = "acceptance"

export default async function Documents({ searchParams }: { searchParams: { q?: string; kind?: string } }) {
  const ctx = await requireClientContext()
  // Proposals are money: never for a VIEWER (SPEC §10.5b, §24 v2); nor their acceptances.
  const money = seesProposals(ctx.role)
  const all = (await orgDocuments(ctx.org.id)).filter((d) => money || !MONEY_DOC_KINDS.includes(d.kind))
  // Cut approvals are records of their own (SPEC §13): read from the approvals table, never a synced Document.
  const approvals = await db.versionApproval.findMany({
    where: { organization_id: ctx.org.id },
    include: { deliverable: { select: { project: { select: { name: true } } } } },
    orderBy: { approved_at: "desc" },
  })
  // So are script approvals (SPEC §30 v2): only THIS org's scripts that this person can open, archived ones included
  // (the record outlives the wrap; the script still opens read-only), never an office-only one. Anyone's approval, as
  // cut approvals list every member's. Never the approver's email, IP, browser or note: name, version, date.
  const scriptApprovals = await db.scriptApproval.findMany({
    where: {
      script: {
        organization_id: ctx.org.id,
        ...visibleScriptsWhere(ctx.org.id, ctx.viewing ? undefined : ctx.user.id, { includeArchived: true }),
      },
    },
    select: { id: true, version_n: true, name: true, created_at: true, script: { select: { id: true, title: true, project: { select: { name: true } } } } },
    orderBy: { created_at: "desc" },
  })
  // So are proposal acceptances (SPEC §24 v2).
  const acceptances = money
    ? await db.proposalAcceptance.findMany({
        where: { organization_id: ctx.org.id },
        include: { document: { select: { project: { select: { name: true } } } } },
        orderBy: { accepted_at: "desc" },
      })
    : []
  const q = (searchParams.q ?? "").trim().toLowerCase()
  const kind = searchParams.kind ?? ""
  const kinds = [...new Set(all.map((d) => d.kind)), ...(approvals.length || scriptApprovals.length ? [APPROVAL] : []), ...(acceptances.length ? [ACCEPTANCE] : [])]
  const label = (k: string) => (k === APPROVAL ? "Approvals" : k === ACCEPTANCE ? "Accepted proposals" : DOC_KIND_LABEL[k] ?? k)
  const matches = (words: (string | null | undefined)[]) => !q || words.filter(Boolean).join(" ").toLowerCase().includes(q)
  const rows = [
    ...all
      .filter((d) => (!kind || d.kind === kind) && matches([d.title, d.description, d.project?.name, DOC_KIND_LABEL[d.kind]]))
      .map((d) => ({ at: d.dated_on?.getTime() ?? 0, row: <DocRow key={d.id} doc={d} /> })),
    ...approvals
      .filter((a) => (!kind || kind === APPROVAL) && matches([a.film_title, a.deliverable.project.name, a.name, "approval approved"]))
      .map((a) => ({ at: a.approved_at.getTime(), row: <ApprovalRow key={a.id} a={a} project={a.deliverable.project.name} /> })),
    ...scriptApprovals
      .filter((a) => (!kind || kind === APPROVAL) && matches([a.script.title, a.script.project?.name, firstName(a.name), "script approval approved"]))
      .map((a) => ({ at: a.created_at.getTime(), row: <ScriptApprovalRow key={`s-${a.id}`} a={a} /> })),
    ...acceptances
      .filter((a) => (!kind || kind === ACCEPTANCE) && matches([a.title, a.document.project?.name, a.name, "proposal accepted"]))
      .map((a) => ({
        at: a.accepted_at.getTime(),
        row: (
          <Link key={a.id} className="cs-row" href={`/client/acceptances/${a.id}`}>
            <span className="cs-ico" aria-hidden>
              <BadgeCheck />
            </span>
            <span className="cs-row-main">
              <strong>{a.title}</strong>
              <small>
                {["Accepted proposal", a.name, a.document.project?.name, a.accepted_at.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <span className="cs-row-end" aria-hidden style={{ color: "var(--mut)" }}>
              <ChevronRight size={18} />
            </span>
          </Link>
        ),
      })),
  ].sort((x, y) => y.at - x.at)
  const total = all.length + approvals.length + scriptApprovals.length + acceptances.length
  const href = (k: string) => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (k) p.set("kind", k)
    const s = p.toString()
    return `/client/documents${s ? `?${s}` : ""}`
  }

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Documents</h1>
      <p className="cs-lede">Everything you&rsquo;ve signed, approved, or received from us.</p>

      <form className="cs-search" action="/client/documents" style={{ marginTop: 20 }} role="search">
        <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Search documents" aria-label="Search documents" />
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <button className="cs-btn" aria-label="Search" style={{ width: 44, padding: 0 }}><Search /></button>
      </form>
      {kinds.length > 1 ? (
        <nav className="cs-filters" aria-label="Filter by kind">
          <Link href={href("")} aria-current={!kind ? "true" : undefined}>All</Link>
          {kinds.map((k) => (
            <Link key={k} href={href(k)} aria-current={kind === k ? "true" : undefined}>{label(k)}</Link>
          ))}
        </nav>
      ) : null}

      <section className="cs-section" style={{ marginTop: 16 }}>
        {rows.length ? (
          <div className="cs-rows">{rows.map((r) => r.row)}</div>
        ) : (
          <div className="cs-card cs-empty">
            <b>{total ? "No matches." : "No documents yet."}</b>
            {total ? <Link className="cs-link" href="/client/documents">Show everything</Link> : null}
          </div>
        )}
      </section>
      <HelpFooter />
    </main>
  )
}

function ApprovalRow({ a, project }: { a: { id: string; film_title: string; review_version_n: number; name: string; approved_at: Date; withdrawn_at: Date | null }; project: string }) {
  const when = a.approved_at.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
  return (
    <Link className="cs-row" href={`/client/approvals/${a.id}`}>
      <span className="cs-ico" aria-hidden>
        <BadgeCheck />
      </span>
      <span className="cs-row-main">
        <strong>
          {a.film_title} · version {a.review_version_n}
        </strong>
        <small>{[a.withdrawn_at ? "Approval (withdrawn)" : "Approval", `${a.name}`, project, when].join(" · ")}</small>
      </span>
      <span className="cs-row-end" aria-hidden style={{ color: "var(--mut)" }}>
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ""

function ScriptApprovalRow({ a }: { a: { version_n: number; name: string; created_at: Date; script: { id: string; title: string; project: { name: string } | null } } }) {
  const when = a.created_at.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
  return (
    <Link className="cs-row" href={`/client/scripts/${a.script.id}`}>
      <span className="cs-ico" aria-hidden>
        <BadgeCheck />
      </span>
      <span className="cs-row-main">
        <strong>
          {a.script.title} · version {a.version_n}
        </strong>
        <small>{["Script approval", firstName(a.name), a.script.project?.name, when].filter(Boolean).join(" · ")}</small>
      </span>
      <span className="cs-row-end" aria-hidden style={{ color: "var(--mut)" }}>
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}
