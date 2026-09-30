// ---------------------------------------------------------------------------
// The price estimator's formula. SERVER-SIDE ONLY: imported by
// app/api/estimate/route.ts and nothing else. The /pricing page never sees
// these numbers; it posts the visitor's choices and gets back a range.
//
// Matter: Matters/price-estimator (opened 9/30/26 from Sam's meeting with
// Andrew). Every constant is tagged with where it came from:
//   SAM   = Sam's own ruling (memory osc-floor-price, sam-day-rate-1000)
//   DRAFT = the worker's placeholder, NOT ruled. Sam changes it or keeps it.
// ---------------------------------------------------------------------------

export type Level = "simple" | "story" | "produced"

export type EstimateInput = {
  level: Level
  shootDays: number // 1-5
  videos: number // finished videos, 1-6
  drone: boolean
  socialCuts: boolean
  flexibleDates: boolean
}

export type Estimate = {
  low: number
  high: number
  from: number
  flexible: { applied: boolean; pctLabel: string; saved: number; heldAtFloor: boolean }
  draft: true
}

// SAM 9/24: $3,999 = 1 shoot day + one finished video up to ~4 min. The floor.
const FLOOR = 3999
// SAM 9/24: a 2nd shoot day is +50% (~$5,999).
const SECOND_DAY = 2000
// SAM 9/24: each shoot day after the 2nd, +$2,500.
const LATER_DAY = 2500
// SAM 9/30: hired labor at cost x 1.30; the assistant costs $500 -> $650.
const CREW_HAND_PER_DAY = 650
// SAM (HANDOFF): ~7% insurance/contingency on a shoot day with hired crew.
const CONTINGENCY = 0.07
// DRAFT: each extra finished video = one more finishing day of Sam's time.
// Grounded in SAM 9/30 "$1,000 take-home any day I work", but the per-video
// price itself is not ruled.
const EXTRA_VIDEO = 1000
// DRAFT: drone on the shoot day. Sam's +$1,000 is for a drone-only PICKUP day;
// using the same number here is the worker's guess.
const DRONE = 1000
// DRAFT: a set of short social cut-downs from the same footage, one finishing day.
const SOCIAL_CUTS = 1000
// DRAFT %: the flexible-dates (booking-window) discount. Size and which
// windows count are OPEN for Sam. Placeholder only.
const FLEX_PCT = 0.1
const FLEX_LABEL = "DRAFT 10%"

// DRAFT: how a "level" maps to extra hired hands per shoot day, ON TOP of
// Sam's formula price. The low end keeps Sam's number as-is where it can (the
// formula already covers a normal day); the high end adds hands. That spread
// IS the range.
//   simple   = +0 to +1 (one person talking, one place)
//   story    = +0 to +2 (a few people, a couple of places)
//   produced = +1 to +3 (a bigger day: more setups, more people)
const CREW: Record<Level, [number, number]> = {
  simple: [0, 1],
  story: [0, 2],
  produced: [1, 3],
}

const clampInt = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
}

export function parseInput(raw: unknown): EstimateInput {
  const r = (raw ?? {}) as Record<string, unknown>
  const level: Level = r.level === "story" || r.level === "produced" ? r.level : "simple"
  return {
    level,
    shootDays: clampInt(r.shootDays, 1, 5, 1),
    videos: clampInt(r.videos, 1, 6, 1),
    drone: r.drone === true,
    socialCuts: r.socialCuts === true,
    flexibleDates: r.flexibleDates === true,
  }
}

function dayPrice(days: number): number {
  if (days <= 1) return FLOOR
  return FLOOR + SECOND_DAY + LATER_DAY * (days - 2)
}

function crewAdd(hands: number, days: number): number {
  return hands * CREW_HAND_PER_DAY * days * (1 + CONTINGENCY)
}

// Quotes end in 999 like Sam's ($3,999, $5,999): round UP to the next $500, less $1.
function quoteNumber(v: number): number {
  return Math.ceil((v + 1) / 500) * 500 - 1
}
// After a discount, end in 99 so it still reads like a quote ($3,599).
function discounted(v: number): number {
  return Math.max(FLOOR, Math.round((v * (1 - FLEX_PCT)) / 100) * 100 - 1)
}

export function estimate(input: EstimateInput): Estimate {
  const base =
    dayPrice(input.shootDays) +
    EXTRA_VIDEO * (input.videos - 1) +
    (input.drone ? DRONE : 0) +
    (input.socialCuts ? SOCIAL_CUTS : 0)

  const [loHands, hiHands] = CREW[input.level]
  let low = quoteNumber(base + crewAdd(loHands, input.shootDays))
  let high = quoteNumber(base + crewAdd(hiHands, input.shootDays))

  let saved = 0
  let heldAtFloor = false
  if (input.flexibleDates) {
    const dLow = discounted(low)
    const dHigh = discounted(high)
    // SAM 9/24: never below $3,999 without Sam saying so. The discount stops at the floor.
    heldAtFloor = dLow === FLOOR && low * (1 - FLEX_PCT) < FLOOR
    saved = high - dHigh
    low = dLow
    high = dHigh
  }

  return {
    low,
    high,
    from: low,
    flexible: { applied: input.flexibleDates, pctLabel: FLEX_LABEL, saved, heldAtFloor },
    draft: true,
  }
}
