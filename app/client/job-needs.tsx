// A job's own Needs-you items (SPEC §28 v2, "Where it stands": Now · Next · that job's Needs-you items). The one-glance
// Home says "1 thing for you" on a job's row; this is where that thing is, one tap from doing it. Amounts are fine
// here (the job page, never Home), and only someone who sees money ever gets an invoice in the list.
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { NeedsItem } from "@/lib/client/data"
import { KIND_LABEL } from "@/lib/client/sign"
import { shareToken } from "@/lib/client/review"
import { day, daysFromToday, money, relativeDue } from "@/lib/client/format"

type Line = { key: string; what: string; title: string; when?: string; late?: boolean; href: string; external?: boolean }

function lineFor(n: NeedsItem, slug: string | null): Line | null {
  switch (n.kind) {
    case "script":
      return {
        key: `c-${n.script.id}`,
        what: "Script",
        title: n.script.title,
        when: n.script.status === "ready_for_ok" ? "Ready for your OK" : "Ready for your notes",
        href: `/client/scripts/${n.script.id}`,
      }
    case "sign": {
      const s = n.item
      return {
        key: `g-${s.id}`,
        what: "To sign",
        title: s.label ?? KIND_LABEL[s.kind],
        when: s.overdue ? "Overdue" : s.due ? `Due ${day(new Date(s.due), { month: "short", day: "numeric" })}` : undefined,
        late: !!s.overdue,
        href: "#paperwork",
      }
    }
    case "proposal":
      return {
        key: `p-${n.doc.id}`,
        what: "Proposal",
        title: n.doc.title,
        when: n.doc.good_until ? `Good until ${day(n.doc.good_until, { month: "short", day: "numeric" })}` : undefined,
        href: `/client/proposals/${n.doc.id}`,
      }
    case "invoice": {
      const inv = n.invoice
      return {
        key: `i-${inv.id}`,
        what: `Invoice ${inv.number}`,
        title: `${money(inv.amount)} · ${inv.title}`,
        when: relativeDue(inv.due_on),
        late: inv.due_on ? daysFromToday(inv.due_on) < 0 : false,
        href: inv.pay_url || "/client/billing",
        external: !!inv.pay_url,
      }
    }
    case "shoot": {
      const s = n.shoot
      const inDays = daysFromToday(s.start_date)
      return {
        key: `s-${s.id}`,
        what: s.description ?? "Filming day",
        title: `${day(s.start_date, { weekday: "long", month: "long", day: "numeric" })}${s.call_time ? `, ${s.call_time}` : ""}`,
        when: inDays < 0 ? "Happening now" : inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`,
        href: "#dates",
      }
    }
    case "review": {
      const ok = n.film.ask === "ok"
      const filmKey = n.film.ext_key?.split("/").pop() ?? ""
      // Review's own number when known, never the book's label (it may name another cut); a Frame.io link keeps it.
      const version = n.version_n ? ` · Version ${n.version_n}` : !shareToken(n.film.review_url) && n.film.version_label ? ` · ${n.film.version_label}` : ""
      if (ok && slug && filmKey) {
        return { key: `r-${n.film.id}`, what: "Ready for your OK", title: `${n.film.name}${version}`, href: `/client/projects/${slug}/approve/${encodeURIComponent(filmKey)}` }
      }
      if (!n.film.review_url) return null
      return { key: `r-${n.film.id}`, what: ok ? "Ready for your OK" : "Ready for your notes", title: `${n.film.name}${version}`, href: n.film.review_url, external: true }
    }
  }
}

/**
 * "Where it stands" for a one-glance client: the next step, then the job's own Needs-you list. When nothing needs
 * them it says so in one calm line, but never while their paperwork can't be checked (fail closed, visibly: the
 * Paperwork section says it's unavailable).
 */
export function WhereItStands({ next, items, slug, paperUnavailable }: { next: string | null; items: NeedsItem[]; slug: string | null; paperUnavailable: boolean }) {
  const lines = items.map((n) => lineFor(n, slug)).filter((l): l is Line => !!l)
  const calm = !lines.length && !paperUnavailable
  return (
    <>
      {next || calm ? (
        <div className="cs-card cs-pad" style={{ marginTop: 14 }}>
          {next ? (
            <p style={{ fontSize: 15 }}>
              <b>Next</b> · {next}
            </p>
          ) : null}
          {calm ? <p className="cs-job-calm">Nothing needs you on this job right now.</p> : null}
        </div>
      ) : null}
      {lines.length ? <NeedsList lines={lines} /> : null}
    </>
  )
}

function NeedsList({ lines }: { lines: Line[] }) {
  return (
    <section className="cs-section" aria-labelledby="job-needs">
      <h2 className="cs-h2">
        <span id="job-needs">Needs you</span>
      </h2>
      <div className="cs-rows">
        {lines.map((l) => {
          const body = (
            <>
              <span className="cs-row-main">
                <small>{l.what}</small>
                <strong>{l.title}</strong>
              </span>
              <span className="cs-row-end">
                {l.when ? <span className={`cs-status ${l.late ? "late" : "due"}`}>{l.when}</span> : null}
                <ChevronRight size={18} color="var(--mut)" aria-hidden />
              </span>
            </>
          )
          return l.external ? (
            <a key={l.key} className="cs-row cs-job-need" href={l.href} target="_blank" rel="noopener">
              {body}
            </a>
          ) : l.href.startsWith("#") ? (
            <a key={l.key} className="cs-row cs-job-need" href={l.href}>
              {body}
            </a>
          ) : (
            <Link key={l.key} className="cs-row cs-job-need" href={l.href}>
              {body}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
