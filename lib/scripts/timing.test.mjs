// The TypeScript timing module must reproduce every vector the reference (scripts/script_timing.py) produced.
// Run: node --test lib/scripts/timing.test.mjs   (Node 23.6+ runs the .ts import by stripping its types)
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { timeText, timeRows, timingLabel } from "./timing.ts"

const v = JSON.parse(readFileSync(new URL("./timing.vectors.json", import.meta.url), "utf8"))

test("every hand-checked line counts the same as the reference", () => {
  for (const c of v.text) {
    const got = timeText(c.text)
    assert.deepEqual([got.words, got.pauses_s, got.blanks], [c.words, c.pauses_s, c.blanks], c.text)
  }
})

test("rows and real scripts total the same", () => {
  for (const c of v.rows) {
    const got = timeRows(c.rows, c.wpm)
    assert.ok(Math.abs(got.total_s - c.total_s) < 1e-3, `${c.name ?? JSON.stringify(c.rows)}: ${got.total_s} vs ${c.total_s}`)
    if (c.words !== undefined) assert.equal(got.words, c.words, c.name)
    if (c.blanks !== undefined) assert.equal(got.blanks, c.blanks, c.name)
  }
})

test("labels read the same", () => {
  for (const c of v.labels) assert.equal(timingLabel(c.total_s, c.target_s, c.blanks), c.label)
})
