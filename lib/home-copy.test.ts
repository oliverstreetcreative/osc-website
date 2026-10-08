// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/home-copy.test.ts   (cwd = the repo)
// The homepage's words (website-redesign SPEC Feature 5): every line carries its source, the house voice holds, and
// the page never claims humility or reaches for a superlative (Sam 10/7: "I genuinely want the brand to be humble").
import { test } from "node:test"
import assert from "node:assert/strict"
import { HOME, allLines } from "./home-copy"

test("every line carries a source tag", () => {
  for (const l of allLines()) {
    assert.ok(l.t.trim().length > 0, "empty line")
    assert.match(l.src, /\b(SAM|SITE|OPEN)\b|marker|label|title|h1/, `source for: ${l.t}`)
  }
})

test("house voice: no em dashes, no straight apostrophes", () => {
  for (const l of allLines()) {
    assert.ok(!l.t.includes("—"), `em dash: ${l.t}`)
    assert.ok(!/[A-Za-z]'[A-Za-z]/.test(l.t), `straight apostrophe: ${l.t}`)
  }
})

test("humility is shown, never claimed: no 'humble', no superlatives", () => {
  const banned = /\b(humble|humility|best|award[- ]winning|world[- ]class|leading|premier|top[- ]rated|unmatched|unparalleled|#1)\b/i
  for (const l of allLines()) assert.doesNotMatch(l.t, banned, l.t)
})

test("the headline's pitch and Sam's memo lines are his words, tagged SAM", () => {
  assert.match(HOME.pitch.src, /^SAM 10\/7/)
  assert.ok(HOME.story.length >= 4)
  for (const l of HOME.story) assert.match(l.src, /^SAM 10\/8 memo/)
  assert.match(HOME.storyH2.src, /^SAM/)
})

test("open lines are few and listed", () => {
  const open = allLines().filter((l) => /^OPEN/.test(l.src))
  assert.deepEqual(
    open.map((l) => l.t),
    ["From Sam"],
  )
})
