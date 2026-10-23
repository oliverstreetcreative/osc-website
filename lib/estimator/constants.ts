// ---------------------------------------------------------------------------
// EVERY number the estimator uses, in one place. Matter: price-estimator.
//
// Each constant carries a tag:
//   SAM   = Sam ruled it (memory sam-day-rate-1000, osc-floor-price). Don't change
//           without him.
//   DRAFT = the worker's placeholder. It shows in the Detailed quote, marked DRAFT,
//           so Sam can override it there and then rule.
//   OPEN  = Sam has said he'll decide (booking-window discount). Placeholder only.
//
// SERVER-SIDE ONLY. Imported by lib/estimator/engine.ts. The public /pricing page
// never receives these values, only a range.
// ---------------------------------------------------------------------------

export type Tag = "SAM" | "DRAFT" | "OPEN"
export type Param = { value: number; tag: Tag; label: string; note?: string }

const p = (value: number, tag: Tag, label: string, note?: string): Param => ({ value, tag, label, note })

// Parameters: one row each, overridable in the Detailed quote by key.
export const PARAMS = {
  // --- days -----------------------------------------------------------------
  samShootDay: p(1000, "SAM", "Sam, per shoot day", "Take-home, Sam 9/30"),
  gearShootDay: p(1000, "SAM", "Owned gear, per shoot day", "Sam 9/30"),
  samPrepDay: p(500, "DRAFT", "Sam, per prep day", "Sam: prep days can be cheaper; amount not ruled"),
  pickupDay: p(1000, "SAM", "Pickup day (camera or drone only)", "Sam 9/24: +$1,000"),
  samFinishDay: p(1000, "SAM", "Sam, per edit/finishing day", "Sam 9/30: $1,000 any day he works"),

  // --- hired labor & hard costs ------------------------------------------------
  markup: p(0.3, "SAM", "Markup on hired labor + hard costs", "Sam 9/30: cost x 1.30"),
  assistantCost: p(500, "SAM", "Assistant, cost per shoot day", "Sam 9/30: $500 -> $650"),
  secondHandCost: p(600, "DRAFT", "Second hand (DP/gaffer), cost per shoot day"),
  rentalCostDay: p(500, "DRAFT", "Extra rentals, cost per shoot day (top tier)"),
  contingency: p(0.07, "SAM", "Insurance/contingency", "On the subtotal before travel; ~7%"),

  // --- "Oliver Street handles..." add-ons (DRAFT) -----------------------------
  scriptDays: p(1, "DRAFT", "Script: writing days at Sam's finishing rate"),
  locationsCost: p(500, "DRAFT", "Locations: scouting/permits allowance (cost)"),
  talentCost: p(500, "DRAFT", "Talent/casting allowance (cost)"),
  musicCost: p(150, "DRAFT", "Music license (cost)"),
  graphicsDays: p(1, "DRAFT", "Graphics: finishing days"),
  droneCharge: p(500, "DRAFT", "Drone on a shoot day (flat)", "Sam's $1,000 is for a drone-only pickup DAY"),
  extraVideoDays: p(1, "DRAFT", "Each extra finished video: finishing days"),

  // --- deadline -----------------------------------------------------------------
  flexibleDiscount: p(0.1, "OPEN", "Flexible dates (booking-window) discount", "Sam decides % and which windows"),
  rushPremium: p(0.2, "DRAFT", "Rush premium"),

  // --- floor, range, rounding --------------------------------------------------
  floor: p(3999, "SAM", "Finished-video floor", "Sam 9/24, ruled final"),
  rangeLow: p(0.1, "DRAFT", "Range spread below the quote"),
  rangeHigh: p(0.25, "DRAFT", "Range spread above the quote"),
  roundTo: p(500, "DRAFT", "Round quotes UP to the next $X,499 / $X,999"),
} as const

export type ParamKey = keyof typeof PARAMS

// --- Simple-quote vocabulary ---------------------------------------------------

export const KINDS = {
  testimonial: { label: "A testimonial", note: "One person talking, one place.", shootDays: 1, prepDays: 0, editDays: 1.5 },
  story: { label: "A story", note: "A few people, a couple of places.", shootDays: 2, prepDays: 1, editDays: 2 },
  production: { label: "A bigger production", note: "More setups, more people, more days.", shootDays: 3, prepDays: 1, editDays: 4 },
} as const
export type Kind = keyof typeof KINDS
// tag for the table above, shown in Detailed
export const KINDS_TAG: Tag = "DRAFT"

// Quality tiers: how many hands, what rentals, how much finishing. All DRAFT.
export const QUALITY = {
  clean: { label: "Clean and simple", note: "Looks professional, nothing fancy.", assistant: false, secondHand: false, rentals: false, editFactor: 1 },
  polished: { label: "Polished", note: "More lights, more angles, more care in the edit.", assistant: true, secondHand: false, rentals: false, editFactor: 1.25 },
  cinematic: { label: "Cinematic", note: "Looks like a movie. A bigger crew and more time.", assistant: true, secondHand: true, rentals: true, editFactor: 1.5 },
} as const
export type Quality = keyof typeof QUALITY
export const QUALITY_TAG: Tag = "DRAFT"

export const DEADLINES = {
  flexible: { label: "Flexible", note: "Let us pick a date that fits our calendar, and you pay less." },
  firm: { label: "Firm", note: "We need it by a certain date." },
  rush: { label: "Rush", note: "We need it fast." },
} as const
export type Deadline = keyof typeof DEADLINES

export const HANDLES = {
  script: { label: "Writing the script", defaultOn: false },
  crewGear: { label: "Crew and gear", defaultOn: true },
  locations: { label: "Finding locations", defaultOn: false },
  talent: { label: "Talent and casting", defaultOn: false },
  editing: { label: "Editing", defaultOn: true },
  music: { label: "Music", defaultOn: true },
  graphics: { label: "Graphics and titles", defaultOn: false },
  drone: { label: "Drone shots", defaultOn: false },
} as const
export type Handle = keyof typeof HANDLES
