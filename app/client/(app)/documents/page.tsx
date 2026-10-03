import Link from "next/link"
import { Search } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgDocuments } from "@/lib/client/data"
import { DOC_KIND_LABEL } from "@/lib/client/format"
import { DocRow, HelpFooter } from "@/app/client/ui"

export const metadata = { title: "Documents" }

export default async function Documents({ searchParams }: { searchParams: { q?: string; kind?: string } }) {
  const ctx = await requireClientContext()
  const all = await orgDocuments(ctx.org.id)
  const q = (searchParams.q ?? "").trim().toLowerCase()
  const kind = searchParams.kind ?? ""
  const kinds = [...new Set(all.map((d) => d.kind))]
  const docs = all.filter(
    (d) =>
      (!kind || d.kind === kind) &&
      (!q || [d.title, d.description, d.project?.name, DOC_KIND_LABEL[d.kind]].filter(Boolean).join(" ").toLowerCase().includes(q)),
  )
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
      <p className="cs-lede">Everything you&rsquo;ve signed or received from us.</p>

      <form className="cs-search" action="/client/documents" style={{ marginTop: 20 }} role="search">
        <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Search documents" aria-label="Search documents" />
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <button className="cs-btn" aria-label="Search" style={{ width: 44, padding: 0 }}><Search /></button>
      </form>
      {kinds.length > 1 ? (
        <nav className="cs-filters" aria-label="Filter by kind">
          <Link href={href("")} aria-current={!kind ? "true" : undefined}>All</Link>
          {kinds.map((k) => (
            <Link key={k} href={href(k)} aria-current={kind === k ? "true" : undefined}>{DOC_KIND_LABEL[k] ?? k}</Link>
          ))}
        </nav>
      ) : null}

      <section className="cs-section" style={{ marginTop: 16 }}>
        {docs.length ? (
          <div className="cs-rows">{docs.map((d) => <DocRow key={d.id} doc={d} />)}</div>
        ) : (
          <div className="cs-card cs-empty">
            <b>{all.length ? "No matches." : "No documents yet."}</b>
            {all.length ? <Link className="cs-link" href="/client/documents">Show everything</Link> : null}
          </div>
        )}
      </section>
      <HelpFooter />
    </main>
  )
}
