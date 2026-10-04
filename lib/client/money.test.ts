// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/money.test.ts
// The money model (SPEC §28 v2) on Torres's real shapes: both directions, two invoices on one job, a share paid on one
// and "to confirm" on another, a payment without an invoice number, staleness, and the two-number balance.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  balance, balanceLine, groupLegs, jobState, legLine, legProblem, resolveBlock, seesMoney,
  type InvoiceFact, type MoneyBlock,
} from "./money"

const TODAY = "2026-10-04"
const none = new Map<string, InvoiceFact>()

const moore: MoneyBlock = {
  as_of: "2026-10-03",
  pattern: "campaign_pays_osc",
  campaign: "Moore for Judge Executive",
  legs: [
    { key: "gm1", from: "campaign", to: "osc", amount: 7500, status: "paid", date: "2026-04-03", invoice: "GM-2026-1" },
    { key: "gm1-share", from: "osc", to: "client", amount: 2500, status: "sent", date: "2026-04-06", for: "GM-2026-1" },
    { key: "gm2", from: "campaign", to: "osc", amount: 1500, status: "paid", date: "2026-06-26", invoice: "GM-2026-2" },
    { key: "gm2-share", from: "osc", to: "client", status: "to_confirm", for: "GM-2026-2" },
  ],
}
const mineer: MoneyBlock = {
  as_of: "2026-10-03",
  pattern: "campaign_pays_client",
  legs: [
    { key: "c", from: "campaign", to: "client", status: "direct" },
    { key: "p", from: "client", to: "osc", amount: 800, status: "paid", date: "2026-03-26" },
  ],
}
const gex: MoneyBlock = {
  as_of: "2026-10-03",
  pattern: "campaign_pays_client",
  legs: [
    { key: "c", from: "campaign", to: "client", status: "direct" },
    { key: "inv", from: "client", to: "osc", status: "invoiced", invoice: "2026-0829" },
  ],
}
const gexInvoices = new Map<string, InvoiceFact>([["2026-0829", { number: "2026-0829", amount: 3000, status: "open", issued_on: "2026-08-29" }]])

test("VIEWERs see no money; owners, approvers, billing and staff viewing do", () => {
  for (const r of ["OWNER", "APPROVER", "BILLING", "STAFF"]) assert.equal(seesMoney(r), true, r)
  for (const r of ["VIEWER", "", null, undefined]) assert.equal(seesMoney(r as string), false, String(r))
})

test("the status table: each direction carries only its own words; to_confirm never has an amount", () => {
  assert.equal(legProblem({ key: "a", from: "campaign", to: "osc", status: "paid", amount: 1 }), null)
  assert.match(legProblem({ key: "b", from: "osc", to: "client", status: "paid", amount: 1 }) ?? "", /isn't a osc>client status/)
  assert.match(legProblem({ key: "c", from: "osc", to: "client", status: "to_confirm", amount: 200 }) ?? "", /never carries an amount/)
  assert.match(legProblem({ key: "d", from: "osc", to: "osc" as "client", status: "paid" }) ?? "", /no such direction/)
  assert.match(legProblem({ key: "e", from: "campaign", to: "osc", status: "paid", amount: -5 }) ?? "", /≥ 0/)
})

test("Moore: two campaign invoices, one share sent, one to confirm, grouped by invoice", () => {
  const r = resolveBlock(moore, none, TODAY)
  const lines = groupLegs(r).map((g) => g.map((x) => legLine(x, moore.as_of)))
  assert.deepEqual(lines, [
    ["The campaign paid OSC $7,500 on Apr 3.", "OSC paid you $2,500 on Apr 6."],
    ["The campaign paid OSC $1,500 on Jun 26.", "OSC → you: to confirm"],
  ])
  assert.equal(jobState(r), "to_confirm") // mixed: the unknown wins
})

test("Mineer: the campaign pays the client directly; a payment with no invoice number still reads as paid", () => {
  const r = resolveBlock(mineer, none, TODAY)
  assert.deepEqual(r.map((x) => legLine(x, mineer.as_of)), ["The campaign pays you directly.", "You paid OSC $800 on Mar 26."])
  assert.equal(jobState(r), "settled")
})

test("Gex: a client→OSC leg takes its amount, status and date from the invoice it names (one source per debt)", () => {
  const r = resolveBlock(gex, gexInvoices, TODAY)
  assert.equal(legLine(r[1], gex.as_of), "You owe OSC $3,000, invoiced Aug 29.")
  assert.equal(jobState(r, 1), "open")
  const paid = new Map(gexInvoices)
  paid.set("2026-0829", { number: "2026-0829", amount: 3000, status: "paid", issued_on: "2026-08-29", paid_on: "2026-10-02" })
  assert.equal(legLine(resolveBlock(gex, paid, TODAY)[1], gex.as_of), "You paid OSC $3,000 on Oct 2.")
  // A payment dated after today is a typo, never a fact.
  const future = new Map(gexInvoices)
  future.set("2026-0829", { number: "2026-0829", amount: 3000, status: "paid", issued_on: "2026-08-29", paid_on: "2026-10-09" })
  assert.equal(legLine(resolveBlock(gex, future, TODAY)[1], gex.as_of), "You → OSC: to confirm")
  // An invoice the book doesn't have can't be stood behind.
  assert.equal(legLine(resolveBlock(gex, none, TODAY)[1], gex.as_of), "You → OSC: to confirm")
  // A voided invoice is neither a debt nor a payment.
  const voided = new Map([["2026-0829", { number: "2026-0829", amount: 3000, status: "void" as const }]])
  assert.equal(resolveBlock(gex, voided, TODAY).length, 1)
})

test("staleness: open legs checked more than 7 days ago read 'to confirm · last checked'; paid ones never go stale", () => {
  // A debt backed by its invoice is the invoice's fact (Billing shows it the same way): it never goes stale.
  const old: MoneyBlock = { ...gex, as_of: "2026-09-25" }
  assert.equal(legLine(resolveBlock(old, gexInvoices, TODAY)[1], old.as_of), "You owe OSC $3,000, invoiced Aug 29.")
  // Without an invoice behind it, an open leg last checked 9 days ago is "to confirm".
  const waiting: MoneyBlock = { ...gex, as_of: "2026-09-25", legs: [gex.legs[0], { key: "a", from: "client", to: "osc", amount: 3000, status: "after_acceptance" }] }
  assert.equal(legLine(resolveBlock(waiting, none, TODAY)[1], waiting.as_of), "You → OSC: to confirm · last checked Sep 25")
  // A check dated in the future, or not a real day, counts as never checked.
  const future: MoneyBlock = { ...waiting, as_of: "2026-12-01" }
  assert.equal(resolveBlock(future, none, TODAY)[1].status, "to_confirm")
  const unreal: MoneyBlock = { ...waiting, as_of: "2026-02-30" }
  assert.equal(resolveBlock(unreal, none, TODAY)[1].status, "to_confirm")
  const oldMoore: MoneyBlock = { ...moore, as_of: "2026-09-01" }
  assert.equal(legLine(resolveBlock(oldMoore, none, TODAY)[0], oldMoore.as_of), "The campaign paid OSC $7,500 on Apr 3.")
})

test("the in-between states Sam's contract needs, in plain words", () => {
  const b: MoneyBlock = {
    as_of: TODAY,
    pattern: "campaign_pays_osc",
    legs: [
      { key: "a", from: "client", to: "osc", amount: 3000, status: "after_acceptance" },
      { key: "inv", from: "campaign", to: "osc", amount: 1000, status: "invoiced", invoice: "C-1" },
      { key: "b", from: "osc", to: "client", amount: 200, status: "after_campaign_pays", for: "C-1" },
      { key: "c", from: "osc", to: "client", amount: 200, status: "owed", for: "C-1" },
    ],
  }
  assert.deepEqual(resolveBlock(b, none, TODAY).map((x) => legLine(x, TODAY)), [
    "OSC invoices you $3,000 once the campaign accepts the spots.",
    "OSC invoiced the campaign $1,000.",
    "OSC pays you $200 after the campaign pays.",
    "OSC owes you $200.",
  ])
  // A share that doesn't name a campaign invoice in this block can't be stood behind.
  const orphan: MoneyBlock = { ...b, legs: [{ key: "s", from: "osc", to: "client", amount: 200, status: "owed", for: "NOPE" }] }
  assert.equal(resolveBlock(orphan, none, TODAY)[0].status, "to_confirm")
  // An owed share with no amount is an unknown, in the job's state as in the balance.
  const noAmount: MoneyBlock = { ...b, legs: [b.legs[1], { key: "s", from: "osc", to: "client", status: "owed", for: "C-1" }] }
  assert.equal(jobState(resolveBlock(noAmount, none, TODAY)), "to_confirm")
})

test("an invoice counts only on a leg that says invoiced or paid, and then the invoice is the one source", () => {
  const leg = (status: "to_confirm" | "after_acceptance") => ({ key: "x", from: "client" as const, to: "osc" as const, status, invoice: "2026-0829" })
  for (const status of ["to_confirm", "after_acceptance"] as const) {
    const b: MoneyBlock = { as_of: TODAY, pattern: "campaign_pays_client", legs: [leg(status)] }
    assert.equal(legLine(resolveBlock(b, gexInvoices, TODAY)[0], TODAY), "You → OSC: to confirm", status)
  }
  const doubled: MoneyBlock = {
    as_of: TODAY,
    pattern: "campaign_pays_client",
    legs: [{ key: "x", from: "client", to: "osc", status: "invoiced", invoice: "2026-0829", amount: 99 }],
  }
  assert.equal(resolveBlock(doubled, gexInvoices, TODAY)[0].status, "to_confirm")
  const noInvoice: MoneyBlock = { as_of: TODAY, pattern: "campaign_pays_client", legs: [{ key: "x", from: "client", to: "osc", status: "invoiced", amount: 1234 }] }
  assert.equal(resolveBlock(noInvoice, none, TODAY)[0].status, "to_confirm")
})

test("two legs with one key both stay on the page", () => {
  const b: MoneyBlock = {
    as_of: TODAY,
    pattern: "campaign_pays_client",
    legs: [
      { key: "same", from: "campaign", to: "client", status: "direct" },
      { key: "same", from: "client", to: "osc", amount: 800, status: "paid", date: "2026-03-26" },
    ],
  }
  assert.equal(groupLegs(resolveBlock(b, none, TODAY)).flat().length, 2)
})

test("a campaign paying the client directly is said to have happened only with a date", () => {
  const b = (date?: string): MoneyBlock => ({ as_of: TODAY, pattern: "campaign_pays_client", legs: [{ key: "c", from: "campaign", to: "client", status: "direct", amount: 9000, date }] })
  assert.equal(legLine(resolveBlock(b(), none, TODAY)[0], TODAY), "The campaign pays you $9,000 directly.")
  assert.equal(legLine(resolveBlock(b("2026-03-03"), none, TODAY)[0], TODAY), "The campaign paid you $9,000 directly on Mar 3.")
})

test("the balance: two numbers, never netted; unknowns counted, never added; 'All square' only when nothing is unknown", () => {
  const all = [...resolveBlock(moore, none, TODAY), ...resolveBlock(mineer, none, TODAY), ...resolveBlock(gex, gexInvoices, TODAY)]
  const b = balance(all, 3000)
  assert.deepEqual(b, { owedToOsc: 3000, owedToClient: 0, toConfirm: 1 })
  assert.equal(balanceLine(b), "You owe OSC $3,000 · OSC owes you $0 · 1 to confirm")
  assert.equal(balanceLine({ owedToOsc: 0, owedToClient: 0, toConfirm: 0 }), "All square")
  assert.equal(balanceLine({ owedToOsc: 0, owedToClient: 0, toConfirm: 2 }), "Nothing open that we know of · 2 to confirm")
  // The campaign→you leg is the client's own business: a "to confirm" there isn't ours to count.
  const theirs = resolveBlock({ as_of: TODAY, pattern: "campaign_pays_client", legs: [{ key: "x", from: "campaign", to: "client", status: "to_confirm" }] }, none, TODAY)
  assert.equal(balance(theirs, 0).toConfirm, 0)
  assert.equal(jobState(theirs), "settled")
})

test("a malformed leg is never shown as fact", () => {
  const bad: MoneyBlock = { as_of: TODAY, pattern: "campaign_pays_osc", legs: [{ key: "x", from: "osc", to: "client", status: "paid", amount: 9 }] }
  assert.equal(legLine(resolveBlock(bad, none, TODAY)[0], TODAY), "OSC → you: to confirm")
})
