// Money between OSC, a client and a third-party payer (a campaign): SPEC §28 v2. Pure: no database, no fetch
// (tested in money.test.ts). Ordinary invoices stay in the book's invoices[]; a `money` block exists only for jobs
// where someone else pays (the campaign), and it never guesses: an unknown leg reads "to confirm".
import { Money } from "./book"
import { money as formatMoney } from "./format"

/** A project's stored money block, re-checked on every read (the column is Json): null when missing or malformed. */
export function moneyOf(json: unknown): MoneyBlock | null {
  if (!json) return null
  const r = Money.safeParse(json)
  return r.success ? (r.data as MoneyBlock) : null
}

/** The client's invoices as the money model reads them (one source per debt). */
export function invoiceFacts(
  invoices: { number: string; amount: unknown; status: string; issued_on?: Date | null; paid_on?: Date | null }[],
): Map<string, InvoiceFact> {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : undefined)
  return new Map(
    invoices.map((i) => [
      i.number,
      {
        number: i.number,
        amount: Number(String(i.amount)),
        status: (i.status === "paid" || i.status === "void" ? i.status : "open") as InvoiceFact["status"],
        issued_on: iso(i.issued_on),
        paid_on: iso(i.paid_on),
      },
    ]),
  )
}

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

/** Documents that are money (a proposal's price, an invoice, a receipt, an agreement's rates): listed and served only to
 *  someone who sees money. */
export const MONEY_DOC_KINDS = ["proposal", "invoice", "receipt", "agreement"]

/** Which statuses each direction may carry. The gate (client_gate.py) lints the same table. */
export const ALLOWED: Record<string, LegStatus[]> = {
  "campaign>osc": ["invoiced", "paid", "to_confirm"],
  "osc>client": ["after_campaign_pays", "owed", "sent", "to_confirm"],
  "client>osc": ["after_acceptance", "invoiced", "paid", "to_confirm"],
  "campaign>client": ["direct", "to_confirm"],
}
const OPEN = new Set<LegStatus>(["invoiced", "owed", "after_campaign_pays", "after_acceptance"])
/** Open, but not owed yet: it becomes a debt when something else happens (the campaign pays, or accepts the spots). */
const PENDING = new Set<LegStatus>(["after_campaign_pays", "after_acceptance"])
export const STALE_DAYS = 7

/** What's wrong with a leg's shape (null = fine). Mirrors the gate's lint, so a bad leg never renders as fact. */
export function legProblem(l: Leg): string | null {
  const dir = `${l.from}>${l.to}`
  const allowed = ALLOWED[dir]
  if (!allowed) return `no such direction ${dir}`
  if (!allowed.includes(l.status)) return `${l.status} isn't a ${dir} status`
  if (l.status === "to_confirm" && l.amount !== undefined) return "to_confirm never carries an amount"
  if (l.amount !== undefined && !(Number.isFinite(l.amount) && l.amount >= 0)) return "amount must be a number ≥ 0"
  if (l.date !== undefined && !realDay(l.date)) return "date must be a real YYYY-MM-DD"
  if (dir === "client>osc" && l.invoice !== undefined) {
    // One source per debt, and only for a debt the leg says exists (review 10/4 MUST-FIX 1): an invoice never turns
    // "to confirm" or "after the campaign accepts" into "you owe".
    if (l.status !== "invoiced" && l.status !== "paid") return "only an invoiced or paid leg names an invoice"
    if (l.amount !== undefined || l.date !== undefined) return "a leg that names an invoice takes its amount and date from it"
  }
  if (dir === "client>osc" && l.status === "invoiced" && l.invoice === undefined) return "an invoiced debt names its invoice"
  return null
}

/** A real calendar day ("2026-02-30" isn't). */
export function realDay(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const x = new Date(`${d}T12:00:00Z`)
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d
}

/** A block's own problems (the gate lints the same): what makes every OPEN leg in it read "to confirm". */
function blockProblem(block: MoneyBlock, today: string): string | null {
  if (!realDay(block.as_of)) return "as_of isn't a real day"
  if (block.as_of > today) return "as_of is in the future"
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
  const unknown: Resolved = { leg: l, status: "to_confirm", stale: false }
  if (legProblem(l)) return unknown
  // A client's share comes out of a campaign invoice in this block, or we can't say what it is.
  if (l.from === "osc" && l.to === "client" && l.status !== "to_confirm") {
    const source = block.legs.find((x) => x.from === "campaign" && x.to === "osc" && x.invoice && x.invoice === l.for)
    if (!source) return unknown
  }
  let status = l.status
  let amount = l.amount
  let date = l.date
  let backedByInvoice = false
  if (l.from === "client" && l.to === "osc" && l.invoice) {
    const inv = invoices.get(l.invoice)
    if (!inv) return unknown
    if (inv.status === "void") return null // a voided invoice is no debt and no payment
    amount = inv.amount
    status = inv.status === "paid" ? "paid" : "invoiced"
    date = inv.status === "paid" ? inv.paid_on ?? undefined : inv.issued_on ?? undefined
    backedByInvoice = true
  }
  if (date && date > today) return unknown // a payment "made" in the future is a typo, not a fact
  // An open leg we last checked too long ago reads "to confirm". A debt backed by its invoice doesn't: the invoice is
  // the one source, and Billing shows it the same way (review 10/4: never one number two ways).
  const stale = !backedByInvoice && OPEN.has(status) && (!!blockProblem(block, today) || daysBetween(block.as_of, today) > STALE_DAYS)
  if (stale) return { leg: l, status: "to_confirm", amount: undefined, date: undefined, stale: true }
  if (status === "to_confirm") amount = undefined
  return { leg: l, status, amount, date, stale: false }
}

export const usd = (n: number) => formatMoney(n)
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
      if (a && r.date) return `The campaign paid you ${a} directly${on}.`
      return a ? `The campaign pays you ${a} directly.` : "The campaign pays you directly."
  }
  return `${cap(who[r.leg.from])} → ${who[r.leg.to]}: to confirm`
}

export type JobMoneyState = "none" | "to_confirm" | "open" | "settled"

/** A job's money in one word: any unknown → to confirm; else anything open → open; else settled. */
export function jobState(resolved: Resolved[], openInvoices = 0): JobMoneyState {
  if (!resolved.length && !openInvoices) return "none"
  const ours = resolved.filter((r) => r.leg.from === "osc" || r.leg.to === "osc") // the campaign→you leg isn't ours
  if (ours.some((r) => r.status === "to_confirm" || (r.leg.from === "osc" && r.status === "owed" && r.amount === undefined)))
    return "to_confirm"
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
  let pending = 0
  for (const r of allResolved) {
    const ours = r.leg.from === "osc" || r.leg.to === "osc"
    if (!ours) continue
    if (r.status === "to_confirm") toConfirm++
    else if (PENDING.has(r.status)) pending++
    else if (r.leg.from === "osc" && r.status === "owed") {
      if (r.amount === undefined) toConfirm++
      else owedToClient += r.amount
    }
  }
  return { owedToOsc: openInvoiceTotal, owedToClient, toConfirm, pending }
}

/**
 * The invoices this job's money lines say are owed NOW: client→OSC legs that resolved to "invoiced" (their invoice is
 * open; one source per debt). One rule for the job page's list, its balance, and Home's "N things for you".
 */
export function namedOpenInvoices(resolved: Resolved[]): Set<string> {
  return new Set(
    resolved.filter((r) => r.leg.from === "client" && r.leg.to === "osc" && r.leg.invoice && r.status === "invoiced").map((r) => r.leg.invoice!),
  )
}

/**
 * What the client owes OSC on ONE job (the job page's balance; Billing's covers every job): the job's own open
 * invoices, plus any open invoice this job's legs say is owed (it may sit on another of their jobs), each counted
 * once. A leg that names an invoice but reads "to confirm" adds nothing: the page never shows one number two ways.
 */
export function jobOpenTotal(
  resolved: Resolved[],
  invoices: { number: string; amount: unknown; status: string; project_id?: string | null }[],
  projectId: string,
): number {
  const named = namedOpenInvoices(resolved)
  const open = new Map<string, number>()
  for (const i of invoices) {
    if (i.status !== "open") continue
    if (i.project_id === projectId || named.has(i.number)) open.set(i.number, Number(String(i.amount)))
  }
  let total = 0
  for (const v of open.values()) if (Number.isFinite(v)) total += v
  return total
}

/**
 * The balance in words: two plain numbers, "· N to confirm", and "All square" only when nothing is unknown AND nothing
 * is waiting to become a debt (review 10/6: "All square" above "OSC invoices you $3,000 once…" reads wrong).
 */
export function balanceLine(b: { owedToOsc: number; owedToClient: number; toConfirm: number; pending?: number }): string {
  const unknown = b.toConfirm ? ` · ${b.toConfirm} to confirm` : ""
  if (!b.owedToOsc && !b.owedToClient) {
    if (b.toConfirm) return `Nothing open that we know of${unknown}`
    return b.pending ? "Nothing owed right now" : "All square"
  }
  return `You owe OSC ${usd(b.owedToOsc)} · OSC owes you ${usd(b.owedToClient)}${unknown}`
}

/** The groups a job page shows: a campaign invoice with the client share that comes out of it, then the rest. */
export function groupLegs(resolved: Resolved[]): Resolved[][] {
  const groups: Resolved[][] = []
  const placed = new Set<Resolved>()
  for (const r of resolved) {
    if (r.leg.from === "campaign" && r.leg.to === "osc") {
      const shares = resolved.filter((s) => !placed.has(s) && s !== r && s.leg.for && s.leg.for === r.leg.invoice)
      groups.push([r, ...shares])
      placed.add(r)
      shares.forEach((s) => placed.add(s))
    }
  }
  for (const r of resolved) if (!placed.has(r)) groups.push([r])
  return groups
}
