// Run: npx tsx --test lib/estimator/engine.test.ts
// Proves the ruling (Sam 10/2): Simple and Detailed are ONE formula, so the
// public range always equals what Detailed produces with default values, and
// Detailed's total sits inside that range. Also pins the ruled doctrine.
import { test } from "node:test"
import assert from "node:assert/strict"
import { quote, simpleRange, parseAnswers, type SimpleAnswers } from "./engine"
import { KINDS, QUALITY, DEADLINES, HANDLES, PARAMS, type Handle } from "./constants"

const handleKeys = Object.keys(HANDLES) as Handle[]
// every subset of handles is 256; cross with 3x3x3 and days = a lot. Sample handles.
const handleSets: Handle[][] = [
  [], ["editing"], ["crewGear"], ["crewGear", "editing"], ["crewGear", "editing", "music"],
  handleKeys, handleKeys.filter((h) => h !== "editing"), ["script", "editing", "graphics", "drone"],
]

function* allAnswers(): Generator<SimpleAnswers> {
  for (const kind of Object.keys(KINDS) as SimpleAnswers["kind"][])
    for (const quality of Object.keys(QUALITY) as SimpleAnswers["quality"][])
      for (const deadline of Object.keys(DEADLINES) as SimpleAnswers["deadline"][])
        for (const handles of handleSets)
          for (const shootDays of [undefined, 1, 3, 5])
            for (const pickupDays of [undefined, 0, 2])
              yield { kind, quality, deadline, handles, shootDays, pickupDays }
}

test("Simple range === Detailed range with default values, and contains the Detailed total", () => {
  let n = 0
  for (const a of allAnswers()) {
    const d = quote(a)
    assert.deepEqual(simpleRange(a), d.range)
    assert.ok(d.range.low <= d.total && d.total <= d.range.high, JSON.stringify(a))
    assert.ok(d.range.low < d.range.high, "a range, never a single number")
    n++
  }
  assert.ok(n > 2000)
})

test("Detailed with no overrides flags nothing as overridden", () => {
  for (const a of allAnswers()) {
    const d = quote(a, {})
    assert.equal(d.specOverridden.length, 0)
    assert.ok(d.params.every((p) => !p.overridden))
    assert.ok(d.lines.every((l) => l.overridden.length === 0))
  }
})

test("doctrine: shoot day = $1,000 Sam + $1,000 owned gear, no markup", () => {
  const d = quote(parseAnswers({ kind: "testimonial", quality: "clean", deadline: "firm", handles: ["crewGear"] }))
  const sam = d.lines.find((l) => l.id === "shootSam")!
  const gear = d.lines.find((l) => l.id === "shootGear")!
  assert.equal(sam.unitCharge, 1000); assert.equal(sam.markup, 0)
  assert.equal(gear.unitCharge, 1000); assert.equal(gear.markup, 0)
})

test("doctrine: hired labor x1.30 (assistant $500 -> $650); travel at cost", () => {
  const a = parseAnswers({ kind: "story", quality: "polished", deadline: "firm", handles: ["crewGear", "editing"] })
  const d = quote(a, { spec: { travel: 400 } })
  const asst = d.lines.find((l) => l.id === "assistant")!
  assert.equal(asst.unitCharge, 650)
  const travel = d.lines.find((l) => l.id === "travel")!
  assert.equal(travel.charge, 400); assert.equal(travel.markup, 0)
})

test("doctrine: a finished video never quotes or ranges under $3,999, even flexible", () => {
  for (const a of allAnswers()) {
    if (!a.handles.includes("editing")) continue
    const d = quote(a)
    assert.ok(d.total >= PARAMS.floor.value && d.range.low >= PARAMS.floor.value, JSON.stringify(a))
  }
})

test("an override wins and is flagged", () => {
  const a = parseAnswers({ kind: "testimonial", quality: "clean", deadline: "firm", handles: ["crewGear", "editing"] })
  const d = quote(a, { lines: { shootSam: { unitCost: 1200 } }, params: { contingency: 0.1 }, spec: { shootDays: 2 } })
  const sam = d.lines.find((l) => l.id === "shootSam")!
  assert.equal(sam.unitCharge, 1200); assert.deepEqual(sam.overridden, ["unitCost"]); assert.equal(sam.qty, 2)
  assert.ok(d.params.find((p) => p.key === "contingency")!.overridden)
  assert.deepEqual(d.specOverridden, ["shootDays"])
})

test("flexible is cheaper than firm, rush dearer (above the floor)", () => {
  const base = { kind: "production", quality: "polished", handles: ["crewGear", "editing"] }
  const f = quote(parseAnswers({ ...base, deadline: "flexible" })).total
  const m = quote(parseAnswers({ ...base, deadline: "firm" })).total
  const r = quote(parseAnswers({ ...base, deadline: "rush" })).total
  assert.ok(f < m && m < r)
})
