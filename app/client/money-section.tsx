// A job's money with a third-party payer (SPEC §28 v2): who pays whom, as dated plain lines grouped by the campaign's
// invoice, with the date the open legs were last checked. Only for someone who sees money; never on Home.
import { balance, balanceLine, groupLegs, invoiceFacts, jobState, legLine, resolveBlock, type MoneyBlock, type JobMoneyState } from "@/lib/client/money"
import { SectionTitle } from "@/app/client/ui"

const FLOW: Record<MoneyBlock["pattern"], string> = {
  campaign_pays_osc: "The campaign → OSC → you",
  campaign_pays_client: "The campaign → you → OSC",
}
const STATE: Record<JobMoneyState, string> = {
  none: "",
  to_confirm: "Some of this is still to confirm",
  open: "Open",
  settled: "Settled",
}
const asOfDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })

type Inv = { number: string; amount: unknown; status: string; issued_on?: Date | null; paid_on?: Date | null; project_id?: string | null }

/** Billing's "between us" card: the balance in two plain numbers across every job, and each job's money lines. */
export function BetweenUs({
  jobs,
  invoices,
  today,
}: {
  jobs: { id: string; name: string; slug: string | null; block: MoneyBlock }[]
  invoices: Inv[]
  today: string
}) {
  if (!jobs.length) return null
  const facts = invoiceFacts(invoices)
  const all = jobs.map((j) => ({ ...j, resolved: resolveBlock(j.block, facts, today) }))
  const openTotal = invoices.filter((i) => i.status === "open").reduce((s, i) => s + Number(String(i.amount)), 0)
  const b = balance(all.flatMap((j) => j.resolved), openTotal)
  return (
    <section className="cs-section">
      <SectionTitle>Between us</SectionTitle>
      <div className="cs-card cs-pad cs-money">
        <p className="cs-money-balance">{balanceLine(b)}</p>
        {all.map((j) => (
          <div key={j.id} className="cs-money-job">
            <p className="cs-eyebrow">{j.name}</p>
            {groupLegs(j.resolved).map((g) => (
              <ul key={g[0].leg.key} className="cs-money-group">
                {g.map((r) => (
                  <li key={r.leg.key} className={r.status === "to_confirm" ? "cs-money-unknown" : undefined}>
                    {legLine(r, j.block.as_of)}
                  </li>
                ))}
              </ul>
            ))}
            <p className="cs-money-asof">As of {asOfDay(j.block.as_of)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function MoneySection({ block, invoices, today, projectId }: { block: MoneyBlock; invoices: Inv[]; today: string; projectId: string }) {
  const resolved = resolveBlock(block, invoiceFacts(invoices), today)
  if (!resolved.length) return null
  const open = invoices.filter((i) => i.project_id === projectId && i.status === "open").length
  const state = jobState(resolved, open)
  return (
    <section className="cs-section">
      <SectionTitle>Money</SectionTitle>
      <div className="cs-card cs-pad cs-money">
        <p className="cs-eyebrow">{FLOW[block.pattern]}</p>
        {groupLegs(resolved).map((g) => (
          <ul key={g[0].leg.key} className="cs-money-group">
            {g.map((r) => (
              <li key={r.leg.key} className={r.status === "to_confirm" ? "cs-money-unknown" : undefined}>
                {legLine(r, block.as_of)}
              </li>
            ))}
          </ul>
        ))}
        <p className="cs-money-asof">
          As of {asOfDay(block.as_of)}
          {STATE[state] ? ` · ${STATE[state]}` : ""}
        </p>
      </div>
    </section>
  )
}
