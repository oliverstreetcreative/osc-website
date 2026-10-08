// ---------------------------------------------------------------------------
// THE pricing engine. ONE formula, two front ends (Sam, 10/2/26):
//   Simple   (public /pricing)        -> simpleRange(answers)      -> {low, high}
//   Detailed (internal /quote-desk)   -> quote(answers, edits)     -> every line + total + the same range
// simpleRange() is literally quote(answers).range, so the client's range always
// comes from the same numbers Detailed shows. engine.test.ts proves it.
//
// SERVER-SIDE ONLY. All numbers live in ./constants.ts.
// ---------------------------------------------------------------------------

import {
  PARAMS, KINDS, QUALITY, DEADLINES, HANDLES,
  type ParamKey, type Tag, type Kind, type Quality, type Deadline, type Handle,
} from "./constants"

export type SimpleAnswers = {
  kind: Kind
  quality: Quality
  deadline: Deadline
  handles: Handle[]
  shootDays?: number // optional adjust, 1-5 (pre-filled from kind)
  pickupDays?: number // optional, 0-3
}

// The Detailed answer set: what Simple implies, every field editable.
export type Spec = {
  prepDays: number
  shootDays: number
  pickupDays: number
  editDays: number
  extraVideos: number
  assistant: boolean
  secondHand: boolean
  rentals: boolean
  travel: number // at cost, no markup
}
export const SPEC_LABELS: Record<keyof Spec, string> = {
  prepDays: "Prep days",
  shootDays: "Shoot days",
  pickupDays: "Pickup days",
  editDays: "Edit/finishing days",
  extraVideos: "Extra finished videos",
  assistant: "Assistant on shoot days",
  secondHand: "Second hand (DP/gaffer)",
  rentals: "Extra rentals",
  travel: "Travel (at cost)",
}

// Detailed edits. Any value can be overridden; the override wins and is flagged.
export type Edits = {
  spec?: Partial<Spec>
  params?: Partial<Record<ParamKey, number>>
  lines?: Record<string, Partial<Record<"qty" | "unitCost" | "markup", number>>>
}

export type Line = {
  id: string
  group: "Days" | "Crew & rentals" | "Oliver Street handles" | "Travel"
  label: string
  qty: number
  unitCost: number
  markup: number // 0.30 = 30%
  unitCharge: number
  cost: number
  charge: number
  tag: Tag
  overridden: ("qty" | "unitCost" | "markup")[]
}

export type Quote = {
  answers: SimpleAnswers
  spec: Spec
  specDefault: Spec
  specOverridden: (keyof Spec)[]
  params: { key: ParamKey; label: string; tag: Tag; note?: string; value: number; default: number; overridden: boolean }[]
  lines: Line[]
  subtotal: number
  contingency: number
  deadlineAdj: number
  travel: number
  beforeFloor: number
  floorApplied: boolean
  total: number
  range: { low: number; high: number }
}

// --- input hygiene -------------------------------------------------------------

const num = (v: unknown, lo: number, hi: number, dflt: number, step = 1) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(hi, Math.max(lo, Math.round(n / step) * step))
}
const oneOf = <T extends string>(v: unknown, keys: readonly T[], dflt: T): T =>
  keys.includes(v as T) ? (v as T) : dflt

export function parseAnswers(raw: unknown): SimpleAnswers {
  const r = (raw ?? {}) as Record<string, unknown>
  const handleKeys = Object.keys(HANDLES) as Handle[]
  const handles = Array.isArray(r.handles)
    ? handleKeys.filter((h) => (r.handles as unknown[]).includes(h))
    : handleKeys.filter((h) => HANDLES[h].defaultOn)
  return {
    kind: oneOf(r.kind, Object.keys(KINDS) as Kind[], "testimonial"),
    quality: oneOf(r.quality, Object.keys(QUALITY) as Quality[], "clean"),
    deadline: oneOf(r.deadline, Object.keys(DEADLINES) as Deadline[], "firm"),
    handles,
    shootDays: r.shootDays == null ? undefined : num(r.shootDays, 1, 5, 1),
    pickupDays: r.pickupDays == null ? undefined : num(r.pickupDays, 0, 3, 0),
  }
}

export function parseEdits(raw: unknown): Edits {
  const r = (raw ?? {}) as Record<string, any>
  const out: Edits = { spec: {}, params: {}, lines: {} }
  const s = r.spec ?? {}
  for (const k of ["prepDays", "shootDays", "pickupDays", "editDays", "extraVideos", "travel"] as const) {
    if (s[k] != null && Number.isFinite(Number(s[k]))) out.spec![k] = Math.max(0, Math.min(k === "travel" ? 1e6 : 60, Number(s[k])))
  }
  for (const k of ["assistant", "secondHand", "rentals"] as const) if (typeof s[k] === "boolean") out.spec![k] = s[k]
  for (const [k, v] of Object.entries(r.params ?? {})) {
    if (k in PARAMS && Number.isFinite(Number(v))) out.params![k as ParamKey] = Number(v)
  }
  for (const [id, f] of Object.entries(r.lines ?? {})) {
    const o: Record<string, number> = {}
    for (const field of ["qty", "unitCost", "markup"] as const) {
      const v = (f as any)?.[field]
      if (v != null && Number.isFinite(Number(v))) o[field] = Number(v)
    }
    if (Object.keys(o).length) out.lines![id] = o
  }
  return out
}

// --- Simple -> Spec ------------------------------------------------------------

export function specFromAnswers(a: SimpleAnswers): Spec {
  const k = KINDS[a.kind]
  const q = QUALITY[a.quality]
  const has = (h: Handle) => a.handles.includes(h)
  const crew = has("crewGear")
  return {
    prepDays: k.prepDays,
    shootDays: a.shootDays ?? k.shootDays,
    pickupDays: a.pickupDays ?? 0,
    editDays: has("editing") ? Math.round(k.editDays * q.editFactor * 2) / 2 : 0,
    extraVideos: 0,
    assistant: crew && q.assistant,
    secondHand: crew && q.secondHand,
    rentals: crew && q.rentals,
    travel: 0,
  }
}

// --- rounding -----------------------------------------------------------------

// Quotes end in 499/999 like Sam's ($3,999, $5,999): UP to the next $500, less $1.
// Always up, so rounding never takes a quote under what the lines cost.
const roundQuote = (v: number, to: number) => Math.max(to - 1, Math.ceil((v + 1) / to) * to - 1)

// --- the formula ----------------------------------------------------------------

export function quote(answers: SimpleAnswers, edits: Edits = {}): Quote {
  // params, with overrides
  const P = {} as Record<ParamKey, number>
  const params: Quote["params"] = []
  for (const key of Object.keys(PARAMS) as ParamKey[]) {
    const d = PARAMS[key]
    const o = edits.params?.[key]
    P[key] = o ?? d.value
    params.push({ key, label: d.label, tag: d.tag, note: d.note, value: P[key], default: d.value, overridden: o != null && o !== d.value })
  }

  // spec, with overrides
  const specDefault = specFromAnswers(answers)
  const spec: Spec = { ...specDefault, ...(edits.spec ?? {}) }
  const specOverridden = (Object.keys(spec) as (keyof Spec)[]).filter((k) => spec[k] !== specDefault[k])

  const has = (h: Handle) => answers.handles.includes(h)
  const lines: Line[] = []
  const M = P.markup
  const add = (id: string, group: Line["group"], label: string, qty: number, unitCost: number, markup: number, tag: Tag) => {
    const o = edits.lines?.[id] ?? {}
    const overridden: Line["overridden"] = []
    if (o.qty != null && o.qty !== qty) { qty = o.qty; overridden.push("qty") }
    if (o.unitCost != null && o.unitCost !== unitCost) { unitCost = o.unitCost; overridden.push("unitCost") }
    if (o.markup != null && o.markup !== markup) { markup = o.markup; overridden.push("markup") }
    if (qty === 0 && overridden.length === 0) return
    const unitCharge = unitCost * (1 + markup)
    lines.push({ id, group, label, qty, unitCost, markup, unitCharge, cost: qty * unitCost, charge: qty * unitCharge, tag, overridden })
  }
  const tagOf = (...keys: ParamKey[]): Tag =>
    keys.some((k) => PARAMS[k].tag === "OPEN") ? "OPEN" : keys.some((k) => PARAMS[k].tag === "DRAFT") ? "DRAFT" : "SAM"
  // a spec-driven qty that came from a DRAFT table (kind/quality) is DRAFT too
  const dq = (t: Tag): Tag => (t === "SAM" ? "DRAFT" : t)

  // Days. Sam's own labor and owned gear: no markup (they are not hard costs).
  add("prep", "Days", "Sam, prep days", spec.prepDays, P.samPrepDay, 0, dq(tagOf("samPrepDay")))
  add("shootSam", "Days", "Sam, shoot days", spec.shootDays, P.samShootDay, 0, "SAM")
  if (has("crewGear")) add("shootGear", "Days", "Owned gear, shoot days", spec.shootDays, P.gearShootDay, 0, "SAM")
  add("pickup", "Days", "Pickup days (camera or drone)", spec.pickupDays, P.pickupDay, 0, "SAM")
  add("edit", "Days", "Sam, edit/finishing days", spec.editDays, P.samFinishDay, 0, dq("SAM"))
  add("extraVideos", "Days", "Extra finished videos (finishing days)", spec.extraVideos * P.extraVideoDays, P.samFinishDay, 0, tagOf("extraVideoDays"))
  // Standard deliverable (Sam 10/7): every FINISHED video ships with its 9:16 + 1:1 adaptations, so they're
  // in the quote by default, never an add-on. No editing = no finished video = no adaptations.
  // Ruled 10/7 23:15: SHOWN at value ($300 each), then INCLUDED: a visible line takes them back off, net zero.
  if (has("editing")) {
    const films = 1 + spec.extraVideos
    add("adaptVertical", "Days", "Vertical 9:16 adaptation (every finished video)", films, P.adaptationValue, 0, tagOf("adaptationValue"))
    add("adaptSquare", "Days", "Square 1:1 adaptation (every finished video)", films, P.adaptationValue, 0, tagOf("adaptationValue"))
    add("adaptIncluded", "Days", "Vertical + square adaptations: included with every film", films, -2 * P.adaptationValue, 0, tagOf("adaptationValue"))
  }

  // Hired labor + rentals: cost x (1 + markup).
  if (spec.assistant) add("assistant", "Crew & rentals", "Assistant", spec.shootDays, P.assistantCost, M, "SAM")
  if (spec.secondHand) add("secondHand", "Crew & rentals", "Second hand (DP/gaffer)", spec.shootDays, P.secondHandCost, M, tagOf("secondHandCost"))
  if (spec.rentals) add("rentals", "Crew & rentals", "Extra rentals", spec.shootDays, P.rentalCostDay, M, tagOf("rentalCostDay"))

  // "Oliver Street handles..." (unchecked = the client brings it)
  if (has("script")) add("script", "Oliver Street handles", "Script", P.scriptDays, P.samFinishDay, 0, tagOf("scriptDays"))
  if (has("locations")) add("locations", "Oliver Street handles", "Locations", 1, P.locationsCost, M, tagOf("locationsCost"))
  if (has("talent")) add("talent", "Oliver Street handles", "Talent and casting", 1, P.talentCost, M, tagOf("talentCost"))
  if (has("music")) add("music", "Oliver Street handles", "Music license", 1, P.musicCost, M, tagOf("musicCost"))
  if (has("graphics")) add("graphics", "Oliver Street handles", "Graphics and titles", P.graphicsDays, P.samFinishDay, 0, tagOf("graphicsDays"))
  if (has("drone")) add("drone", "Oliver Street handles", "Drone on the shoot", 1, P.droneCharge, 0, tagOf("droneCharge"))

  // Travel: at cost, no markup, outside contingency and the deadline adjustment.
  add("travel", "Travel", "Travel (at cost)", spec.travel > 0 ? 1 : 0, spec.travel, 0, "SAM")

  const subtotal = lines.filter((l) => l.group !== "Travel").reduce((s, l) => s + l.charge, 0)
  const contingency = subtotal * P.contingency
  const base = subtotal + contingency
  const deadlineAdj =
    answers.deadline === "flexible" ? -base * P.flexibleDiscount : answers.deadline === "rush" ? base * P.rushPremium : 0
  const travel = lines.find((l) => l.id === "travel")?.charge ?? 0
  const beforeFloor = base + deadlineAdj + travel

  // The $3,999 floor is for a FINISHED video (editing handled). The flexible
  // discount never takes a finished video under it.
  const floorOn = has("editing")
  const floorApplied = floorOn && beforeFloor < P.floor
  const raw = floorApplied ? P.floor : beforeFloor
  let total = roundQuote(raw, P.roundTo)
  if (floorOn) total = Math.max(total, P.floor)

  let low = roundQuote(total * (1 - P.rangeLow), P.roundTo)
  let high = roundQuote(total * (1 + P.rangeHigh), P.roundTo)
  if (floorOn) low = Math.max(low, P.floor)
  low = Math.min(low, total)
  high = Math.max(high, total)
  if (high === low) high = low + P.roundTo

  return {
    answers, spec, specDefault, specOverridden, params, lines,
    subtotal, contingency, deadlineAdj, travel, beforeFloor, floorApplied, total,
    range: { low, high },
  }
}

// The public Simple quote: the range ONLY. Same formula, default values.
export function simpleRange(answers: SimpleAnswers): { low: number; high: number } {
  return quote(answers).range
}
