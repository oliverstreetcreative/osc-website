// The history's "what changed" (SPEC §14 phone moment 5).
// Run: node --conditions=import --import tsx --test lib/scripts/diff.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { sideOf, wordDiff } from "./diff"
import { rng } from "./fuzzkit"

test("a one-word fix reads as one word out, one word in", () => {
  const d = wordDiff("Hi. Im Mike Harmon and I am running.", "Hi. I’m Mike Harmon and I am running.")
  assert.deepEqual(d, [
    { op: "=", text: "Hi. " },
    { op: "-", text: "Im" },
    { op: "+", text: "I’m" },
    { op: "=", text: " Mike Harmon and I am running." },
  ])
})

test("both sides always rebuild exactly (500 random pairs)", () => {
  const words = ["vote", "Harmon", "the", "and", "I’m", "$___", "million", "\n", "Kentucky!", "re-election"]
  for (let seed = 1; seed <= 500; seed++) {
    const r = rng(seed)
    const make = () => Array.from({ length: Math.floor(r() * 40) }, () => words[Math.floor(r() * words.length)]).join(r() < 0.5 ? " " : "  ")
    const a = make()
    const b = r() < 0.3 ? a : make()
    const d = wordDiff(a, b)
    assert.equal(sideOf(d, "before"), a, `seed ${seed}`)
    assert.equal(sideOf(d, "after"), b, `seed ${seed}`)
    if (a === b) assert.ok(d.every((p) => p.op === "="))
  }
})
