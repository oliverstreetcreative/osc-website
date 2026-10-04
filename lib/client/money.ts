// Money between OSC, a client and a third-party payer (a campaign): SPEC §28 v2. Pure: no database, no fetch
// (tested in money.test.ts). Ordinary invoices stay in the book's invoices[]; a `money` block exists only for jobs
// where someone else pays (the campaign), and it never guesses: an unknown leg reads "to confirm".

export type Party = "campaign" | "client" | "osc"
export type LegStatus =
  | "invoiced" // →OSC: OSC has invoiced the payer
  | "paid" // →OSC: the payer paid OSC
  | "after_campaign_pays" // OSC→client: the client's share, due once the campaign pays OSC
  | "owed" // OSC→client: the share is due now
  | "sent" // OSC→client: OSC paid the share
  | "after_acceptance" // client→OSC: OSC invoices the client once the campaign accepts the spots
  | "direct" // campaign→client: the campaign pays the client; their business
  | "to_confirm" // anything we can't stand behind; never carries an amount

export type Leg = {
  key: string
  from: Party
  to: "client" | "osc"
  amount?: number
  status: LegStatus
  date?: string // YYYY-MM-DD
  invoice?: string // OSC's invoice number, on a →OSC leg
  for?: string // a client share's campaign invoice (the →OSC leg's `invoice`)
}

export type MoneyBlock = {
  as_of: string // YYYY-MM-DD: when the open legs were last checked against the bank
  pattern: "campaign_pays_client" | "campaign_pays_osc"
  campaign?: string
  legs: Leg[]
}

/** An invoice TO the client (the book's invoices[]), the one source for a client→OSC leg that names it. */
export type InvoiceFact = { number: string; amount: number; status: "open" | "paid" | "void"; issued_on?: string; paid_on?: string }

/** One rule for every money surface (SPEC §10.5b, §28 v2): a VIEWER sees no money; staff viewing see what the client sees. */
export const seesMoney = (role: string | null | undefined) =>
  role === "OWNER" || role === "APPROVER" || role === "BILLING" || role === "STAFF"

/** Documents that are money (a proposal's price, an invoice, a receipt): listed only for someone who sees money. */
export const MONEY_DOC_KINDS = ["proposal", "invoice", "receipt"]

/** Which statuses each direction may carry. The gate (client_gate.py) lints the same table. */
export const ALLOWED: Record<string, LegStatus[]> = {
  "campaign>osc": ["invoiced", "paid", "to_confirm"],
  "osc>client": ["after_campaign_pays", "owed", "sent", "to_confirm"],
  "client>osc": ["after_acceptance", "invoiced", "paid", "to_confirm"],
  "campaign>client": ["direct", "to_confirm"],
}
const OPEN = new Set<LegStatus>(["invoiced", "owed", "after_campaign_pays", "after_acceptance"])
export const STALE_DAYS = 7

/** What's wrong with a leg's shape (null = fine). Mirrors the gate's lint, so a bad leg never renders as fact. */
export function legProblem(l: Leg): string | null {
  const dir = `${l.from}>${l.to}`
  const allowed = ALLOWED[dir]
  if (!allowed) return `no such direction ${dir}`
  if (!allowed.includes(l.status)) return `${l.status} isn't a ${dir} status`
  if (l.status === "to_confirm" && l.amount !== undefined) return "to_confirm never carries an amount"
  if (l.amount !== undefined && !(Number.isFinite(l.amount) && l.amount >= 0)) return "amount must be a number ≥ 0"
  if (l.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return "date must be YYYY-MM-DD"
  return null
}

export type Resolved = { leg: Leg; status: LegStatus; amount?: number; date?: string; stale: boolean }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)

/**
 * The leg as the client should see it today. A client→OSC leg that names an invoice takes its amount, status and date
 * from that invoice (one source per debt). An open leg checked more than STALE_DAYS ago, a malformed leg, or a leg
 * naming an invoice we don't have, reads "to confirm".
 */
export function resolveLeg(l: Leg, block: MoneyBlock, invoices: Map<string, InvoiceFact>, today: string): Resolved | null {
  if (legProblem(l)) return { leg: l, status: "to_confirm", stale: false }
  let status = l.status
  let amount = l.amount
  let date = l.date
  if (l.from === "client" && l.to === "osc" && l.invoice) {
    const inv = invoices.get(l.invoice)
    if (!inv) return { leg: l, status: "to_confirm", stale: false }
    if (inv.status === "void") return null // a voided invoice is no debt and no payment
    amount = inv.amount
    status = inv.status === "paid" ? "paid" : "invoiced"
    date = inv.status === "paid" ? inv.paid_on ?? undefined : inv.issued_on ?? undefined
  }
  const stale = OPEN.has(status) && daysBetween(block.as_of, today) > STALE_DAYS
  if (stale) return { leg: l, status: "to_confirm", amount: undefined, date: undefined, stale: true }
  if (status === "to_confirm") amount = undefined
  return { leg: l, status, amount, date, stale: false }
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })
const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
const who: Record<Party, string> = { campaign: "the campaign", client: "you", osc: "OSC" }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The plain line for one resolved leg ("you" is the client). Never invents an amount or a date. */
export function legLine(r: Resolved, asOf: string): string {
  const a = r.amount !== undefined ? usd(r.amount) : null
  const on = r.date ? ` on ${shortDay(r.date)}` : ""
  const dir = `${r.leg.from}>${r.leg.to}`
  if (r.status === "to_confirm") {
    const base = `${cap(who[r.leg.from])} → ${who[r.leg.to]}: to confirm`
    return r.stale ? `${base} · last checked ${shortDay(asOf)}` : base
  }
  switch (`${dir}:${r.status}`) {
    case "campaign>osc:invoiced":
      return a ? `OSC invoiced the campaign ${a}${on}.` : `OSC invoiced the campaign${on}.`
    case "campaign>osc:paid":
      return a ? `The campaign paid OSC ${a}${on}.` : `The campaign paid OSC${on}.`
    case "osc>client:after_campaign_pays":
      return a ? `OSC pays you ${a} after the campaign pays.` : "OSC pays you your share after the campaign pays."
    case "osc>client:owed":
      return a ? `OSC owes you ${a}.` : "OSC owes you your share: amount to confirm."
    case "osc>client:sent":
      return a ? `OSC paid you ${a}${on}.` : `OSC paid you your share${on}.`
    case "client>osc:after_acceptance":
      return a ? `OSC invoices you ${a} once the campaign accepts the spots.` : "OSC invoices you once the campaign accepts the spots."
    case "client>osc:invoiced":
      return a ? `You owe OSC ${a}, invoiced${on.replace(" on", "")}.` : `You owe OSC: invoiced${on.replace(" on", "")}.`
    case "client>osc:paid":
      return a ? `You paid OSC ${a}${on}.` : `You paid OSC${on}.`
    case "campaign>client:direct":
      return a ? `The campaign paid you ${a}${on}.` : "The campaign pays you directly."
  }
  return `${cap(who[r.leg.from])} → ${who[r.leg.to]}: to confirm`
}

export type JobMoneyState = "none" | "to_confirm" | "open" | "settled"

/** A job's money in one word: any unknown → to confirm; else anything open → open; else settled. */
export function jobState(resolved: Resolved[], openInvoices = 0): JobMoneyState {
  if (!resolved.length && !openInvoices) return "none"
  const ours = resolved.filter((r) => r.leg.from === "osc" || r.leg.to === "osc") // the campaign→you leg isn't ours
  if (ours.some((r) => r.status === "to_confirm")) return "to_confirm"
  if (openInvoices || ours.some((r) => OPEN.has(r.status))) return "open"
  return "settled"
}

/** Resolve a whole block (null when the block itself is missing). Legs on a voided invoice drop out. */
export function resolveBlock(block: MoneyBlock | null | undefined, invoices: Map<string, InvoiceFact>, today: string): Resolved[] {
  if (!block) return []
  return block.legs.map((l) => resolveLeg(l, block, invoices, today)).filter((r): r is Resolved => !!r)
}

/**
 * The balance between OSC and the client across jobs: two numbers, never netted. "You owe OSC" counts the client's
 * OPEN invoices (one source per debt); "OSC owes you" counts shares that are owed now with a known amount. Unknowns
 * are counted, never added: a to-confirm leg OSC is a party to, or an owed share without an amount.
 */
export function balance(allResolved: Resolved[], openInvoiceTotal: number) {
  let owedToClient = 0
  let toConfirm = 0
  for (const r of allResolved) {
    const ours = r.leg.from === "osc" || r.leg.to === "osc"
    if (!ours) continue
    if (r.status === "to_confirm") toConfirm++
    else if (r.leg.from === "osc" && r.status === "owed") {
      if (r.amount === undefined) toConfirm++
      else owedToClient += r.amount
    }
  }
  return { owedToOsc: openInvoiceTotal, owedToClient, toConfirm }
}

/** The balance in words: two plain numbers, "· N to confirm", and "All square" only when nothing is unknown. */
export function balanceLine(b: { owedToOsc: number; owedToClient: number; toConfirm: number }): string {
  const unknown = b.toConfirm ? ` · ${b.toConfirm} to confirm` : ""
  if (!b.owedToOsc && !b.owedToClient) return b.toConfirm ? `Nothing open that we know of${unknown}` : "All square"
  return `You owe OSC ${usd(b.owedToOsc)} · OSC owes you ${usd(b.owedToClient)}${unknown}`
}

/** The groups a job page shows: a campaign invoice with the client share that comes out of it, then the rest. */
export function groupLegs(resolved: Resolved[]): Resolved[][] {
  const groups: Resolved[][] = []
  const placed = new Set<string>()
  for (const r of resolved) {
    if (r.leg.from === "campaign" && r.leg.to === "osc") {
      const shares = resolved.filter((s) => s.leg.for && s.leg.for === r.leg.invoice)
      groups.push([r, ...shares])
      placed.add(r.leg.key)
      shares.forEach((s) => placed.add(s.leg.key))
    }
  }
  for (const r of resolved) if (!placed.has(r.leg.key)) groups.push([r])
  return groups
}
