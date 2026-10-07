// The one-glance Home (SPEC §28 v2): a client with little time sees every job in two lines, how many things need
// them, how many jobs are finished, and money as COUNTS only. Words only on Home: he may open it to show a candidate a
// cut, so amounts (another campaign's, his own share) never appear here. Amounts live on Billing and the job page.
import Link from "next/link"
import { ChevronRight, Receipt } from "lucide-react"
import type { NeedsItem, ProjectWithAll } from "@/lib/client/data"
import { needsProjectId } from "@/lib/client/data"
import { balance, invoiceFacts, jobState, moneyOf, namedOpenInvoices, resolveBlock, type Resolved } from "@/lib/client/money"
import { PhasePill, SectionTitle } from "@/app/client/ui"

type Inv = { number: string; amount: unknown; status: string; issued_on?: Date | null; paid_on?: Date | null; project_id?: string | null }

/** Each job's money, resolved once: the per-job state decides Finished, the counts feed the money line. */
export function jobMoney(projects: ProjectWithAll[], invoices: Inv[], today: string) {
  const facts = invoiceFacts(invoices)
  const byProject = new Map<string, { resolved: Resolved[]; openInvoices: number; named: Set<string> }>()
  for (const p of projects) {
    const resolved = resolveBlock(moneyOf(p.money), facts, today)
    const openInvoices = invoices.filter((i) => i.project_id === p.id && i.status === "open").length
    byProject.set(p.id, { resolved, openInvoices, named: namedOpenInvoices(resolved) })
  }
  return byProject
}

export function GlanceSections({
  projects,
  needs,
  invoices,
  money,
  today,
}: {
  projects: ProjectWithAll[]
  needs: NeedsItem[]
  invoices: Inv[]
  money: boolean
  today: string
}) {
  const perJob = jobMoney(projects, money ? invoices : [], today)
  const settled = (p: ProjectWithAll) => {
    if (!money) return true // money isn't theirs to see, so it can't hold a job open for them
    const m = perJob.get(p.id)!
    const s = jobState(m.resolved, m.openInvoices)
    return s === "none" || s === "settled"
  }
  const finished = projects.filter((p) => (p.phase === "delivered" || p.phase === "paid") && settled(p))
  const active = projects.filter((p) => !finished.includes(p))
  const forYou = new Map<string, number>()
  for (const n of needs) {
    const ids = new Set<string>()
    const id = needsProjectId(n)
    if (id) ids.add(id)
    // An invoice a job's money lines say is owed counts on that job too, as its page lists it (review 10/6).
    if (n.kind === "invoice") for (const [pid, m] of perJob) if (m.named.has(n.invoice.number)) ids.add(pid)
    for (const pid of ids) forYou.set(pid, (forYou.get(pid) ?? 0) + 1)
  }
  const openCount = money ? invoices.filter((i) => i.status === "open").length : 0
  const toConfirm = money ? balance([...perJob.values()].flatMap((m) => m.resolved), 0).toConfirm : 0
  const moneyBits = [
    openCount ? `${openCount} invoice${openCount === 1 ? "" : "s"} open` : null,
    toConfirm ? `${toConfirm} to confirm` : null,
  ].filter(Boolean)

  return (
    <>
      {active.length ? (
        <section className="cs-section" aria-labelledby="jobs">
          <SectionTitle href="/client/projects" link="All">
            <span id="jobs">Your jobs</span>
          </SectionTitle>
          <div className="cs-rows cs-jobs">
            {active.map((p) => {
              const n = forYou.get(p.id) ?? 0
              return (
                <Link key={p.id} href={`/client/projects/${p.slug}`} className="cs-row cs-job">
                  <span className="cs-row-main">
                    <strong>
                      {p.name} <PhasePill phase={p.phase} />
                    </strong>
                    {p.status_line ? (
                      <small>
                        <b>Now</b> · {p.status_line}
                      </small>
                    ) : null}
                    {p.next_step ? (
                      <small>
                        <b>Next</b> · {p.next_step}
                      </small>
                    ) : null}
                  </span>
                  <span className="cs-row-end">
                    {n ? <span className="cs-status due">{n === 1 ? "1 thing for you" : `${n} things for you`}</span> : null}
                    <ChevronRight size={18} color="var(--mut)" aria-hidden />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {finished.length ? (
        <section className="cs-section">
          <Link href="/client/projects" className="cs-card cs-row" style={{ borderRadius: 16 }}>
            <span className="cs-row-main">
              <strong>
                {finished.length} finished {finished.length === 1 ? "job" : "jobs"}
              </strong>
              <small>{finished.map((p) => p.name).join(" · ")}</small>
            </span>
            <ChevronRight size={18} color="var(--mut)" aria-hidden />
          </Link>
        </section>
      ) : null}

      {money && (projects.length || invoices.length) ? (
        <section className="cs-section">
          <Link href="/client/billing" className="cs-card cs-row" style={{ borderRadius: 16 }}>
            <span className="cs-ico">
              <Receipt />
            </span>
            <span className="cs-row-main">
              <strong>Money</strong>
              <small>{moneyBits.length ? moneyBits.join(" · ") : "Nothing open"}</small>
            </span>
            <ChevronRight size={18} color="var(--mut)" aria-hidden />
          </Link>
        </section>
      ) : null}
    </>
  )
}
