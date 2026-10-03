import Link from "next/link"
import { Check } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgInvoices, orgDocuments } from "@/lib/client/data"
import { money, day, relativeDue, daysFromToday } from "@/lib/client/format"
import { DocRow, HelpFooter, SectionTitle } from "../ui"

export const metadata = { title: "Billing" }

export default async function Billing() {
  const ctx = await requireClientContext()
  const invoices = await orgInvoices(ctx.org.id)
  const vendorDocs = (await orgDocuments(ctx.org.id)).filter((d) => d.kind === "w9" || d.kind === "coi")
  const open = invoices.filter((i) => i.status === "open")
  const paid = invoices.filter((i) => i.status === "paid")
  const balance = open.reduce((s, i) => s + Number(i.amount.toString()), 0)
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount.toString()), 0)
  const onlyPay = open.length === 1 ? open[0] : null

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Billing</h1>

      <section className="cs-section" style={{ marginTop: 20 }}>
        {open.length ? (
          <div className="cs-card cs-total">
            <div>
              <p className="cs-eyebrow">Open balance</p>
              <p className="num">{money(balance)}</p>
              <p className="cs-lede" style={{ marginTop: 8 }}>
                {open.length === 1 ? relativeDue(open[0].due_on) : `${open.length} open invoices`}
              </p>
            </div>
            {onlyPay?.pay_url ? <a className="cs-btn" href={onlyPay.pay_url} target="_blank" rel="noopener">Pay {money(balance)}</a> : null}
          </div>
        ) : (
          <div className="cs-card cs-calm">
            <span className="cs-calm-dot"><Check size={22} /></span>
            <div>
              <h3>You&rsquo;re paid up.</h3>
              <p>{paid.length ? `Thank you. ${money(paidTotal)} paid across ${paid.length} invoice${paid.length === 1 ? "" : "s"}.` : "Nothing to pay right now."}</p>
            </div>
          </div>
        )}
      </section>

      {open.length ? (
        <section className="cs-section">
          <SectionTitle>Open</SectionTitle>
          <div className="cs-rows">
            {open.map((inv) => {
              const late = inv.due_on ? daysFromToday(inv.due_on) < 0 : false
              return (
                <div key={inv.id} className="cs-row" style={{ flexWrap: "wrap" }}>
                  <span className="cs-row-main">
                    <strong>{inv.title}</strong>
                    <small>Invoice {inv.number}{inv.project ? ` · ${inv.project.name}` : ""} · sent {day(inv.issued_on)}</small>
                  </span>
                  <span className="cs-row-end">
                    <strong>{money(inv.amount)}</strong>
                    <span className={`cs-status ${late ? "late" : "due"}`}>{relativeDue(inv.due_on)}</span>
                  </span>
                  {inv.pay_url ? (
                    <a className="cs-btn sm" style={{ width: "100%" }} href={inv.pay_url} target="_blank" rel="noopener">Pay online (bank transfer or card)</a>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="cs-section">
        <SectionTitle>Paid</SectionTitle>
        {paid.length ? (
          <div className="cs-rows">
            {paid.map((inv) => (
              <div key={inv.id} className="cs-row">
                <span className="cs-row-main">
                  <strong>{inv.title}</strong>
                  <small>
                    Invoice {inv.number}
                    {inv.project ? <> · <Link href={`/client/projects/${inv.project.slug}`}>{inv.project.name}</Link></> : null}
                  </small>
                </span>
                <span className="cs-row-end">
                  <strong>{money(inv.amount)}</strong>
                  <span className="cs-status paid">Paid {day(inv.paid_on)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cs-card cs-empty">No paid invoices yet.</div>
        )}
      </section>

      {vendorDocs.length ? (
        <section className="cs-section">
          <SectionTitle>For your vendor files</SectionTitle>
          <div className="cs-rows">{vendorDocs.map((d) => <DocRow key={d.id} doc={d} showProject={false} />)}</div>
        </section>
      ) : null}

      <p className="cs-lede" style={{ marginTop: 18, fontSize: 13 }}>
        Invoices are paid through Mercury, our bank, by bank transfer or card. Checks are welcome too: Oliver Street Creative, 521 Oliver St, Covington, KY 41014.
      </p>

      <HelpFooter />
    </main>
  )
}
