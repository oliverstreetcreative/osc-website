// A job's own Needs-you items (SPEC §28 v2, "Where it stands": Now · Next · that job's Needs-you items). The one-glance
// Home says "1 thing for you" on a job's row; this is where that thing is, one tap from doing it. Amounts are fine
// here (the job page, never Home), and only someone who sees money ever gets an invoice in the list.
import Link from "next/link"
import { ChevronRight, FileSignature } from "lucide-react"
import type { NeedsItem } from "@/lib/client/data"
import { KIND_LABEL } from "@/lib/client/sign"
import { cutVersion, scriptAsk, shootWhen } from "@/lib/client/needs-words"
import { day, daysFromToday, money, relativeDue } from "@/lib/client/format"

type Line = { key: string; what: string; title: string; when?: string; late?: boolean; href: string; external?: boolean; off?: boolean }
type Job = { id: string; slug: string | null }

function lineFor(n: NeedsItem, job: Job, demo: boolean): Line | null {
  switch (n.kind) {
    case "script":
      return { key: `c-${n.script.id}`, what: "Script", title: n.script.title, when: scriptAsk(n.script.status), href: `/client/scripts/${n.script.id}` }
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
      // Pay when there's a pay link. Otherwise the Billing list of the invoice's OWN job, which opens in that job's org
      // (/client/billing shows the selected org, which may not be this one: review 10/6).
      const list = inv.project_id === job.id ? "#billing" : inv.project?.slug ? `/client/projects/${inv.project.slug}#billing` : "/client/billing"
      return {
        key: `i-${inv.id}`,
        what: `Invoice ${inv.number}`,
        title: `${money(inv.amount)} · ${inv.title}`,
        when: relativeDue(inv.due_on),
        late: inv.due_on ? daysFromToday(inv.due_on) < 0 : false,
        href: inv.pay_url || list,
        external: !!inv.pay_url,
        off: demo && !!inv.pay_url, // the demo's pay links are placeholders, as on Home
      }
    }
    case "shoot": {
      const s = n.shoot
      return {
        key: `s-${s.id}`,
        what: s.description ?? "Filming day",
        title: `${day(s.start_date, { weekday: "long", month: "long", day: "numeric" })}${s.call_time ? `, ${s.call_time}` : ""}`,
        when: shootWhen(daysFromToday(s.start_date)),
        href: "#dates",
      }
    }
    case "review": {
      const ok = n.film.ask === "ok"
      const filmKey = n.film.ext_key?.split("/").pop() ?? ""
      const base = { key: `r-${n.film.id}`, what: ok ? "Ready for your OK" : "Ready for your notes", title: `${n.film.name}${cutVersion(n.film, n.version_n)}`, off: demo }
      if (ok && job.slug && filmKey) return { ...base, href: `/client/projects/${job.slug}/approve/${encodeURIComponent(filmKey)}` }
      if (!n.film.review_url) return null
      return { ...base, href: n.film.review_url, external: true }
    }
  }
}

/**
 * "Where it stands" for a one-glance client: the next step, then the job's own Needs-you list. No "nothing needs you"
 * line: the page can't vouch for paperwork it couldn't ask about (review 10/6). When Sign Here can't answer, it says
 * so HERE, at the top, as Home does: on a phone the Paperwork section is far below.
 */
export function WhereItStands({ next, items, job, demo, paperUnavailable }: { next: string | null; items: NeedsItem[]; job: Job; demo: boolean; paperUnavailable: boolean }) {
  const lines = items.map((n) => lineFor(n, job, demo)).filter((l): l is Line => !!l)
  return (
    <>
      {next ? (
        <div className="cs-card cs-pad" style={{ marginTop: 14 }}>
          <p style={{ fontSize: 15 }}>
            <b>Next</b> · {next}
          </p>
        </div>
      ) : null}
      {paperUnavailable ? (
        <div className="cs-card cs-need" style={{ marginTop: 14 }}>
          <div className="cs-need-top">
            <span className="cs-eyebrow"><FileSignature size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Paperwork</span>
          </div>
          <h3>Unavailable right now</h3>
          <p>We can&rsquo;t check what needs signing at the moment. Try again in a few minutes.</p>
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
          const main = (
            <span className="cs-row-main">
              <small>{l.what}</small>
              <strong>{l.title}</strong>
            </span>
          )
          if (l.off) {
            return (
              <div key={l.key} className="cs-row" aria-disabled="true">
                {main}
                <span className="cs-row-end">
                  <span className="cs-status">Off in the demo</span>
                </span>
              </div>
            )
          }
          const body = (
            <>
              {main}
              <span className="cs-row-end">
                {l.when ? <span className={`cs-status ${l.late ? "late" : "due"}`}>{l.when}</span> : null}
                <ChevronRight size={18} color="var(--mut)" aria-hidden />
              </span>
            </>
          )
          return l.external ? (
            <a key={l.key} className="cs-row" href={l.href} target="_blank" rel="noopener">
              {body}
            </a>
          ) : l.href.startsWith("#") ? (
            <a key={l.key} className="cs-row" href={l.href}>
              {body}
            </a>
          ) : (
            <Link key={l.key} className="cs-row" href={l.href}>
              {body}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
