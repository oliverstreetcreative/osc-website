// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/faq.test.ts   (cwd = the repo)
// The FAQ's gates (website-redesign SPEC Feature 4): a draft can never reach the live site, even through a
// wholesale staging -> main merge. Plus the hours piece's arithmetic.
import { test } from "node:test"
import assert from "node:assert/strict"
import { FAQ, FAQ_PUBLIC, faqIsUp, faqRenders, showMarkers, showStoryHours, visibleEntries, type FaqEntry } from "./faq"
import { KINDS, STEPS, STORY_HOURS_ARE_SAMS, hrs, storyTotal } from "./story-hours"

const prod = { production: true }
const staging = { production: false }

test("production renders /faq only once it's public; staging and dev always do", () => {
  assert.equal(faqRenders(prod, false), false)
  assert.equal(faqRenders(prod, true), true)
  assert.equal(faqRenders(staging, false), true)
  // today: not public, so production 404s
  assert.equal(FAQ_PUBLIC, false)
  assert.equal(faqRenders(prod), false)
})

test("production shows Sam's own answers only; staging shows every entry", () => {
  const e = (id: string, status: FaqEntry["status"]): FaqEntry => ({ id, q: id, a: [], status, src: "test" })
  const all = [e("a", "sam"), e("b", "draft"), e("c", "open")]
  assert.deepEqual(
    visibleEntries(all, prod).map((x) => x.id),
    ["a"],
  )
  assert.deepEqual(
    visibleEntries(all, staging).map((x) => x.id),
    ["a", "b", "c"],
  )
})

test("the FAQ is up only with something to show: a public page with no approved answers stays down", () => {
  const e = (id: string, status: FaqEntry["status"]): FaqEntry => ({ id, q: id, a: [], status, src: "test" })
  assert.equal(faqIsUp(prod, [e("a", "draft")], true), false, "public but nothing approved: no page, no button")
  assert.equal(faqIsUp(prod, [e("a", "sam")], true), true)
  assert.equal(faqIsUp(prod, [e("a", "sam")], false), false, "not public yet")
  assert.equal(faqIsUp(staging, [e("a", "open")], false), true, "staging shows drafts")
  assert.equal(faqIsUp(prod), false, "today's live site: down")
})

test("the hours piece shows in production only once the hours are Sam's; markers never do", () => {
  assert.equal(showStoryHours(prod, false), false)
  assert.equal(showStoryHours(prod, true), true)
  assert.equal(showStoryHours(staging, false), true)
  assert.equal(STORY_HOURS_ARE_SAMS, false) // placeholders today
  assert.equal(showMarkers(prod), false)
  assert.equal(showMarkers(staging), true)
})

test("every entry is well formed: unique anchors, an answer unless open, a source tag in src", () => {
  const ids = FAQ.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length, "duplicate anchor")
  for (const x of FAQ) {
    assert.match(x.id, /^[a-z0-9-]+$/, `anchor ${x.id}`)
    assert.ok(x.q.trim().endsWith("?"), `question mark on ${x.id}`)
    if (x.status === "open") assert.equal(x.a.length, 0, `${x.id} is open but has an answer`)
    else assert.ok(x.a.length > 0, `${x.id} needs an answer`)
    assert.match(x.src, /\b(SAM|NEW|SITE|TERMS|OPEN)\b/, `${x.id} src tag`)
  }
  assert.equal(FAQ[0].id, "iphone", "Sam's question is #1")
  assert.equal(FAQ[0].widget, "story-hours")
})

test("the story work is the sum of its steps; every kind has one number per step", () => {
  const expected: Record<string, [number, number]> = { testimonial: [2, 18], story: [16, 44], bigger: [24, 70] }
  for (const k of KINDS) {
    assert.equal(k.steps.length, STEPS.length, `${k.key} steps`)
    assert.deepEqual([k.filming, storyTotal(k)], expected[k.key], `${k.key} (the mock's placeholders)`)
    for (const h of k.steps) assert.ok(Number.isInteger(h) && h > 0, `${k.key} step hours`)
  }
  assert.deepEqual(
    KINDS.map((k) => k.key),
    ["testimonial", "story", "bigger"],
  )
})

test("house voice: no em dashes and no straight apostrophes in anything a visitor reads", () => {
  const texts: [string, string][] = []
  for (const x of FAQ) {
    for (const t of [x.q, ...x.a, ...(x.after ?? []), ...(x.link ? [x.link.lead, x.link.label] : [])]) texts.push([x.id, t])
  }
  for (const s of STEPS) texts.push(["steps", s.name], ["steps", s.why])
  for (const k of KINDS) texts.push(["kinds", k.label])
  for (const [id, t] of texts) {
    assert.ok(!t.includes("—"), `em dash in ${id}: ${t}`)
    assert.ok(!/[A-Za-z]'[A-Za-z]/.test(t), `straight apostrophe in ${id}: ${t}`)
  }
})

test("hours read 1 hr / N hrs", () => {
  assert.equal(hrs(1), "1 hr")
  assert.equal(hrs(2), "2 hrs")
  assert.equal(hrs(18), "18 hrs")
})
