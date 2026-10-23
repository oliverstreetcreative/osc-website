// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/sign.test.ts
// The portal's signing rules (SPEC §22 v2.1): who asks Sign Here and as which org, when a client sees a SAMPLE, and what
// "Needs you" holds. Pure: no engine, no database.
import { test } from "node:test"
import assert from "node:assert/strict"
import { signedDay, forClient, needsSigning, showSamples, signOrgFor, signedNotCleared, type NeededSignature } from "./sign"
import { SIGN_TWIN } from "./rehearsal"

test("staging: ONLY the signing twin asks, as Sign Here's bundled test org", () => {
  assert.equal(signOrgFor(SIGN_TWIN.slug, true), "osc-staging-test")
  for (const slug of ["beech-acres", "rehearsal-osc", "demo-fernwood", `${SIGN_TWIN.slug}--preview`, "osc-staging-test", "", null]) {
    assert.equal(signOrgFor(slug, true), null, String(slug))
  }
})

test("anywhere else: a real org asks under its own slug; never a rehearsal, demo or preview org", () => {
  assert.equal(signOrgFor("beech-acres", false), "beech-acres")
  for (const slug of [SIGN_TWIN.slug, "rehearsal-osc", "demo-fernwood", "beech-acres--preview", "", undefined]) {
    assert.equal(signOrgFor(slug, false), null, String(slug))
  }
})

test("samples reach a client only on staging with SIGN_SHOW_SAMPLES=1", () => {
  const before = process.env.SIGN_SHOW_SAMPLES
  try {
    process.env.SIGN_SHOW_SAMPLES = "1"
    assert.equal(showSamples(true), true)
    assert.equal(showSamples(false), false) // production (or any non-staging) ignores the env
    process.env.SIGN_SHOW_SAMPLES = "yes"
    assert.equal(showSamples(true), false)
    delete process.env.SIGN_SHOW_SAMPLES
    assert.equal(showSamples(true), false)
  } finally {
    if (before === undefined) delete process.env.SIGN_SHOW_SAMPLES
    else process.env.SIGN_SHOW_SAMPLES = before
  }
})

const item = (o: Partial<NeededSignature>): NeededSignature => ({
  id: o.id ?? "99-002/x/1",
  job: "99-002",
  kind: "client_agreement",
  date: null,
  who: { name: "Client Test", email: SIGN_TWIN.email },
  can_start: true,
  status: "missing",
  agreement_id: null,
  signed_at: null,
  ...o,
})

test("a client sees their own client-kind paper; samples only when asked to show them; staff see every member's", () => {
  const mine = item({ id: "a" })
  const sample = item({ id: "b", sample: true, kind: "talent_release" })
  const theirs = item({ id: "c", who: { name: "Other", email: "other@client.org" } })
  const crew = item({ id: "d", kind: "crew_deal_memo" })
  const all = [mine, sample, theirs, crew]
  const ids = (xs: NeededSignature[]) => xs.map((x) => x.id)
  assert.deepEqual(ids(forClient(all, { email: SIGN_TWIN.email.toUpperCase() }, false)), ["a"])
  assert.deepEqual(ids(forClient(all, { email: SIGN_TWIN.email }, true)), ["a", "b"])
  assert.deepEqual(ids(forClient(all, { staff: true }, false)), ["a", "b", "c"])
})

test("Needs you = not signed, not cleared, and startable now (Sign Here: status !== signed)", () => {
  assert.equal(needsSigning(item({ state: "missing", status: "missing" })), true)
  assert.equal(needsSigning(item({ state: "sent", status: "sent" })), true)
  assert.equal(needsSigning(item({ state: "link_expired", status: "sent", link_expired: true })), true)
  assert.equal(needsSigning(item({ state: "missing", status: "missing", can_start: false })), false) // OSC sets it up first
  assert.equal(needsSigning(item({ state: "signed", status: "signed", satisfied: false, can_start: false })), false)
  assert.equal(needsSigning(item({ state: "signed_sample", status: "signed", satisfied: false, sample: true })), false)
  assert.equal(needsSigning(item({ state: "signed", status: "signed", satisfied: true })), false)
  assert.equal(needsSigning(item({ state: "on_file", status: "missing", satisfied: true })), false) // cleared another way
})

test("staff viewing as the client see what the client still owes (the engine sends staff can_start: false)", () => {
  assert.equal(needsSigning(item({ state: "missing", status: "missing", can_start: false }), true), true)
  assert.equal(needsSigning(item({ state: "sent", status: "sent", can_start: false }), true), true)
  assert.equal(needsSigning(item({ state: "signed", status: "signed", satisfied: false, can_start: false }), true), false)
  assert.equal(needsSigning(item({ state: "signed", status: "signed", satisfied: true, can_start: false }), true), false)
})

test("signed but not cleared: the engine's plain 'signed' with satisfied false; a signed sample has its own words", () => {
  assert.equal(signedNotCleared(item({ state: "signed", status: "signed", satisfied: false })), true)
  assert.equal(signedNotCleared(item({ status: "signed", satisfied: false })), true) // no state: the v1 view
  assert.equal(signedNotCleared(item({ state: "signed_sample", status: "signed", satisfied: false })), false)
  assert.equal(signedNotCleared(item({ state: "signed", status: "signed", satisfied: true })), false)
  assert.equal(signedNotCleared(item({ state: "sent", status: "sent" })), false)
})

test("a signed date as the person would say it: a plain date is that day; a timestamp is its Eastern day", () => {
  assert.equal(signedDay("2026-10-03"), "Oct 3")
  assert.equal(signedDay("2026-10-04T01:00:00Z"), "Oct 3") // 9 PM Eastern on the 3rd
  assert.equal(signedDay("2026-10-03T14:00:00-04:00"), "Oct 3")
  assert.equal(signedDay("not a date"), "")
  assert.equal(signedDay(null), "")
})
