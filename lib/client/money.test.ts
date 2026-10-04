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
  paid.set("2026-0829", { number: "2026-0829", amount: 3000, status: "paid", issued_on: "2026-08-29", paid_on: "2026-10-09" })
  assert.equal(legLine(resolveBlock(gex, paid, TODAY)[1], gex.as_of), "You paid OSC $3,000 on Oct 9.")
  // An invoice the book doesn't have can't be stood behind.
  assert.equal(legLine(resolveBlock(gex, none, TODAY)[1], gex.as_of), "You → OSC: to confirm")
  // A voided invoice is neither a debt nor a payment.
  const voided = new Map([["2026-0829", { number: "2026-0829", amount: 3000, status: "void" as const }]])
  assert.equal(resolveBlock(gex, voided, TODAY).length, 1)
})

test("staleness: open legs checked more than 7 days ago read 'to confirm · last checked'; paid ones never go stale", () => {
  const old: MoneyBlock = { ...gex, as_of: "2026-09-25" }
  const r = resolveBlock(old, gexInvoices, TODAY)
  assert.equal(legLine(r[1], old.as_of), "You → OSC: to confirm · last checked Sep 25")
  const oldMoore: MoneyBlock = { ...moore, as_of: "2026-09-01" }
  assert.equal(legLine(resolveBlock(oldMoore, none, TODAY)[0], oldMoore.as_of), "The campaign paid OSC $7,500 on Apr 3.")
})

test("the in-between states Sam's contract needs, in plain words", () => {
  const b: MoneyBlock = {
    as_of: TODAY,
    pattern: "campaign_pays_osc",
    legs: [
      { key: "a", from: "client", to: "osc", amount: 3000, status: "after_acceptance" },
      { key: "b", from: "osc", to: "client", amount: 200, status: "after_campaign_pays" },
      { key: "c", from: "osc", to: "client", amount: 200, status: "owed" },
    ],
  }
  assert.deepEqual(resolveBlock(b, none, TODAY).map((x) => legLine(x, TODAY)), [
    "OSC invoices you $3,000 once the campaign accepts the spots.",
    "OSC pays you $200 after the campaign pays.",
    "OSC owes you $200.",
  ])
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
