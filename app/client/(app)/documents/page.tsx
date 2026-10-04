import Link from "next/link"
import { BadgeCheck, ChevronRight, Search } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgDocuments } from "@/lib/client/data"
import { DOC_KIND_LABEL } from "@/lib/client/format"
import { DocRow, HelpFooter } from "@/app/client/ui"
import { db } from "@/lib/db"

export const metadata = { title: "Documents" }

const APPROVAL = "approval"

export default async function Documents({ searchParams }: { searchParams: { q?: string; kind?: string } }) {
  const ctx = await requireClientContext()
  const all = await orgDocuments(ctx.org.id)
  // Cut approvals are records of their own (SPEC §13): read from the approvals table, never a synced Document.
  const approvals = await db.versionApproval.findMany({
    where: { organization_id: ctx.org.id },
    include: { deliverable: { select: { project: { select: { name: true } } } } },
    orderBy: { approved_at: "desc" },
  })
  const q = (searchParams.q ?? "").trim().toLowerCase()
  const kind = searchParams.kind ?? ""
  const kinds = [...new Set(all.map((d) => d.kind)), ...(approvals.length ? [APPROVAL] : [])]
  const label = (k: string) => (k === APPROVAL ? "Approvals" : DOC_KIND_LABEL[k] ?? k)
  const matches = (words: (string | null | undefined)[]) => !q || words.filter(Boolean).join(" ").toLowerCase().includes(q)
  const rows = [
    ...all
      .filter((d) => (!kind || d.kind === kind) && matches([d.title, d.description, d.project?.name, DOC_KIND_LABEL[d.kind]]))
      .map((d) => ({ at: d.dated_on?.getTime() ?? 0, row: <DocRow key={d.id} doc={d} /> })),
    ...approvals
      .filter((a) => (!kind || kind === APPROVAL) && matches([a.film_title, a.deliverable.project.name, a.name, "approval approved"]))
      .map((a) => ({ at: a.approved_at.getTime(), row: <ApprovalRow key={a.id} a={a} project={a.deliverable.project.name} /> })),
  ].sort((x, y) => y.at - x.at)
  const total = all.length + approvals.length
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
