// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/faq.test.ts   (cwd = the repo)
// The FAQ's gates (website-redesign SPEC Feature 4): a draft can never reach the live site, even through a
// wholesale staging -> main merge or a build that can't tell where it's running. Plus the hours piece's arithmetic
// and the house voice over every string a visitor reads.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  FAQ,
  FAQ_PAGE,
  FAQ_PUBLIC,
  GUIDE_IS_FINAL,
  draftsAllowed,
  faqIsUp,
  faqRenders,
  showLink,
  showMarkers,
  showStoryHours,
  statusPill,
  visibleEntries,
  type FaqEntry,
} from "./faq"
import { KINDS, MINUTES, PIECE, REFERENCE, STEPS, STORY_PIECE_APPROVED, captureHours, days, hrs, pct, shootDays, storyHours, summary } from "./story-hours"

const prod = { production: true }
const staging = { production: false }
const e = (id: string, status: FaqEntry["status"], extra: Partial<FaqEntry> = {}): FaqEntry => ({
  id,
  q: `${id}?`,
  a: [],
  status,
  src: "test",
  ...extra,
})

test("drafts show only where the site KNOWS it's staging or dev: an unknown build is the live site (fail closed)", () => {
  assert.equal(draftsAllowed(false, "production"), false, "a production build that can't see Railway's env")
  assert.equal(draftsAllowed(false, undefined), false)
  assert.equal(draftsAllowed(false, "test"), false)
  assert.equal(draftsAllowed(true, "production"), true, "Railway staging")
  assert.equal(draftsAllowed(false, "development"), true, "next dev")
})

test("the live site renders /faq only once it's public; staging and dev always do", () => {
  assert.equal(faqRenders(prod, false), false)
  assert.equal(faqRenders(prod, true), true)
  assert.equal(faqRenders(staging, false), true)
  assert.equal(FAQ_PUBLIC, false, "not public today")
  assert.equal(faqRenders(prod), false)
})

test("the live site shows approved answers only - not drafts in Sam's own words; staging shows every entry", () => {
  const all = [e("a", "approved", { approvedOn: "2026-10-09" }), e("b", "draft", { words: "sam" }), e("c", "draft"), e("d", "open")]
  assert.deepEqual(
    visibleEntries(all, prod).map((x) => x.id),
    ["a"],
  )
  assert.deepEqual(
    visibleEntries(all, staging).map((x) => x.id),
    ["a", "b", "c", "d"],
  )
})

test("the FAQ is up only with something to show: public with no approved answers stays down", () => {
  assert.equal(faqIsUp(prod, [e("a", "draft", { words: "sam" })], true), false, "his words, not his OK")
  assert.equal(faqIsUp(prod, [e("a", "approved", { approvedOn: "2026-10-09" })], true), true)
  assert.equal(faqIsUp(prod, [e("a", "approved", { approvedOn: "2026-10-09" })], false), false, "not public yet")
  assert.equal(faqIsUp(staging, [e("a", "open")], false), true, "staging shows drafts")
  assert.equal(faqIsUp(prod), false, "today's live site: down")
})

test("the hours piece, the draft guide link and the markers stay off the live site until approved or final", () => {
  assert.equal(showStoryHours(prod, false), false)
  assert.equal(showStoryHours(prod, true), true)
  assert.equal(showStoryHours(staging, false), true)
  assert.equal(STORY_PIECE_APPROVED, false, "placeholder hours and mock copy today")

  const guide = { lead: "l", label: "x", href: "/g.pdf", draftFile: true }
  assert.equal(showLink(guide, prod, false), false, "the guide is still a working draft")
  assert.equal(showLink(guide, prod, true), true)
  assert.equal(showLink(guide, staging, false), true)
  assert.equal(showLink({ lead: "l", label: "x", href: "/a" }, prod, false), true, "an ordinary link")
  assert.equal(GUIDE_IS_FINAL, false)

  assert.equal(showMarkers(prod), false)
  assert.equal(showMarkers(staging), true)
})

test("staging pills say where each answer stands", () => {
  assert.equal(statusPill(e("a", "approved", { approvedOn: "2026-10-09" })), FAQ_PAGE.pill.approved)
  assert.equal(statusPill(e("b", "draft", { words: "sam" })), FAQ_PAGE.pill.draftSam)
  assert.equal(statusPill(e("c", "draft")), FAQ_PAGE.pill.draft)
  assert.equal(statusPill(e("d", "open")), FAQ_PAGE.pill.open)
})

test("every entry is well formed; an approval carries its date, and none is invented", () => {
  const ids = FAQ.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length, "duplicate anchor")
  for (const x of FAQ) {
    assert.match(x.id, /^[a-z0-9-]+$/, `anchor ${x.id}`)
    assert.ok(x.q.trim().endsWith("?"), `question mark on ${x.id}`)
    if (x.status === "open") assert.equal(x.a.length, 0, `${x.id} is open but has an answer`)
    else assert.ok(x.a.length > 0, `${x.id} needs an answer`)
    if (x.status === "approved") assert.match(x.approvedOn ?? "", /^2026-(1[0-2])-\d{2}$|^20(2[7-9]|[3-9]\d)-\d{2}-\d{2}$/, `${x.id} approvedOn`)
    else assert.equal(x.approvedOn, undefined, `${x.id} has a date but isn't approved`)
    if (x.status === "approved") assert.equal(x.openPart, undefined, `${x.id} is approved with a part still open`)
    if (x.openPart) assert.match(x.src, /\bOPEN\b/, `${x.id} has an open part, so its src says OPEN`)
    assert.match(x.src, /\b(SAM|NEW|SITE|TERMS|OPEN)\b/, `${x.id} src tag`)
  }
  // Sam has approved nothing yet (10/8). When he does, set status "approved" + approvedOn and update this count.
  assert.equal(FAQ.filter((x) => x.status === "approved").length, 0)
  assert.equal(FAQ[0].id, "iphone", "Sam's question is #1")
  assert.equal(FAQ[0].widget, "story-hours")
})

test("the hours model matches price-estimator's table (hours-model.md): story 12/min, capture = shoot days x 10", () => {
  const k = Object.fromEntries(KINDS.map((x) => [x.key, x]))
  // hours-model.md's table: capture / story at 1, 3, 5 finished minutes
  const table: Record<string, [number, number, number]> = { testimonial: [10, 10, 10], story: [10, 10, 20], bigger: [10, 20, 40] }
  for (const [key, caps] of Object.entries(table)) {
    assert.deepEqual([1, 3, 5].map((m) => captureHours(k[key], m)), caps, key)
  }
  assert.deepEqual([1, 3, 5].map(storyHours), [12, 36, 60])
  assert.equal(shootDays(k.bigger, 4), 3, "1.5 min a day: 4 min = 3 days, rounded up")
  assert.equal(shootDays(k.testimonial, 1), 1, "never under one day")
  for (const x of KINDS) for (const m of MINUTES) {
    const c = pct(captureHours(x, m)), st = pct(storyHours(m))
    assert.ok(c > 0 && c <= 100 && st > 0 && st <= 100, `${x.key} ${m}`)
  }
  assert.equal(STEPS.length, 7)
  assert.ok(STEPS.every((s) => !/\d/.test(s)), "no hours per step (nobody measured the split)")
})

test("house voice: no em dashes and no straight apostrophes in anything a visitor reads", () => {
  const texts: [string, string][] = []
  for (const x of FAQ) {
    for (const t of [x.q, ...x.a, ...(x.after ?? []), ...(x.link ? [x.link.lead, x.link.label] : [])]) texts.push([x.id, t])
  }
  for (const s of STEPS) texts.push(["steps", s])
  for (const k of KINDS) for (const m of MINUTES) texts.push(["kinds", k.label], ["summary", summary(k, m)])
  texts.push(["ref", REFERENCE.text], ["ref", REFERENCE.label])
  for (const [k, v] of Object.entries(PIECE)) texts.push([`PIECE.${k}`, v])
  for (const [k, v] of Object.entries(FAQ_PAGE)) {
    if (typeof v === "string") texts.push([`FAQ_PAGE.${k}`, v])
    else for (const [k2, v2] of Object.entries(v)) texts.push([`FAQ_PAGE.${k}.${k2}`, v2])
  }
  for (const [id, t] of texts) {
    assert.ok(!t.includes("—"), `em dash in ${id}: ${t}`)
    assert.ok(!/[A-Za-z]'[A-Za-z]/.test(t), `straight apostrophe in ${id}: ${t}`)
  }
})

test("hours and days read naturally; screen readers hear whole words", () => {
  assert.equal(hrs(1), "1 hr")
  assert.equal(hrs(12), "12 hrs")
  assert.equal(days(1), "1 shoot day")
  assert.equal(days(2), "2 shoot days")
  assert.equal(summary(KINDS[0], 3), "A 3-minute video of people talking: about 10 hours of filming and 36 hours of story work.")
})
