// "Where the hours go": what goes into a video, per FINISHED MINUTE. FAQ #1's answer, built from price-estimator's
// model v2 (Matters/price-estimator/concept/hours-model.md + story-hours-mock-v2.html, Majordomo 10/8 ~11:58).
//
// Sam, 10/8 ~11:42: "We had it pegged at like 10 hours of editing per finished minute on average across the fleet.
// Like 9-10. Editing and finishing. Add prep in and maybe it's 12 per finished minute. ... The point is we're trying to
// illustrate for them that the capture is not the big deal. It's a big deal, but it's not the biggest deal."
//
// The model's rules (hours-model.md): story work = 12 hrs x finished minutes (Sam). Capture = shoot days x 10 hrs,
// shoot days = ceil(minutes / finished-minutes-per-shoot-day), min 1, rates from the OSC rate library (density.json).
// The steps are DESCRIPTIVE ONLY - no hours per step (nobody has measured the split). Never revive the dropped,
// unsourced figures. The 10 hrs a shoot day and the 5 / 3 / 1.5 rates wait on Sam's OK (ticket T427);
// STORY_PIECE_APPROVED flips only when he has OK'd the numbers AND the piece's words.

export const STORY_PIECE_APPROVED = false

/** Sam 10/8: ~10 editing + finishing and ~2 prep per finished minute. */
export const STORY_HOURS_PER_MIN = 12
/** ASSUMPTION (price-estimator), the one capture number not from a document; awaiting Sam (T427). */
export const HOURS_PER_SHOOT_DAY = 10
export const MINUTES = [1, 2, 3, 4, 5] as const
export type Minutes = (typeof MINUTES)[number]

export type KindKey = "testimonial" | "story" | "bigger"

export interface Kind {
  key: KindKey
  label: string
  /** finished minutes per shoot day, from the rate library (density.json content levels) */
  minPerDay: number
  /** for the still-picture caption and the screen-reader summary */
  noun: string
}

export const KINDS: readonly Kind[] = [
  { key: "testimonial", label: "People talking", minPerDay: 5, noun: "video of people talking" },
  { key: "story", label: "A story", minPerDay: 3, noun: "story" },
  { key: "bigger", label: "Bigger", minPerDay: 1.5, noun: "bigger production" },
]

export const DEFAULT = { kind: "testimonial" as KindKey, minutes: 3 as Minutes }

/** The bars share one scale: the largest story bar (5 min x 12 = 60 hrs), as in the mock. */
export const SCALE_MAX = STORY_HOURS_PER_MIN * MINUTES[MINUTES.length - 1]

export function shootDays(k: Kind, minutes: number): number {
  return Math.max(1, Math.ceil(minutes / k.minPerDay))
}
export function captureHours(k: Kind, minutes: number): number {
  return shootDays(k, minutes) * HOURS_PER_SHOOT_DAY
}
export function storyHours(minutes: number): number {
  return minutes * STORY_HOURS_PER_MIN
}
/** Bar width, % of the shared scale (capture can't exceed it with these rates; capped anyway). */
export function pct(hours: number): number {
  return Math.round((1000 * Math.min(hours, SCALE_MAX)) / SCALE_MAX) / 10
}

export function hrs(n: number): string {
  return `${n} ${n === 1 ? "hr" : "hrs"}`
}
export function days(n: number): string {
  return `${n} ${n === 1 ? "shoot day" : "shoot days"}`
}

/** One sentence for screen readers per kind + length (whole words, not "hrs"). */
export function summary(k: Kind, minutes: number): string {
  const h = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`
  return `A ${minutes}-minute ${k.noun}: about ${h(captureHours(k, minutes))} of filming and ${h(storyHours(minutes))} of story work.`
}

/** What the story work is (descriptive only; no hours per step). The mock v2's list. */
export const STEPS: readonly string[] = [
  "Finding the right person and the story worth telling",
  "A real conversation before the camera is on",
  "Planning the questions",
  "Watching and logging every minute of footage",
  "Finding the story in it, and deciding what to leave out",
  "Editing, then color, sound and music",
  "Your notes, our changes, until it’s right",
]

/** The one outside reference point on the page (hours-model.md, checked by the coordinator 10/1). */
export const REFERENCE = {
  text: "For comparison: documentary editors plan about a month of editing for every 10 finished minutes.",
  label: "Alliance of Documentary Editors",
  href: "https://allianceofdoceditors.com/wp-content/uploads/2022/02/ADE_Edit_Schedules_final2.pdf",
}

/** The piece's words (the mock v2's, NEW unless tagged; Sam OKs them with the piece). */
export const PIECE = {
  eyebrow: "What goes into a video",
  heading: "Where the hours go",
  draftPill: "Draft numbers · waiting on Sam’s OK",
  kindsLegend: "What kind of video?",
  lengthLegend: "How long is the finished video?",
  stillCaption: "For a 3-minute video of people talking:",
  filming: "Filming",
  filmingMine: "Filming: you can do this part",
  story: "Story work",
  storySub: "About 12 hours for every finished minute",
  switchLabel: "I’ll film it myself on my phone",
  switchOff: "See what’s left.",
  switchOn: "The story work didn’t change. That’s the part that takes experience.",
  stepsHeading: "The story work",
  // SAM 10/8 ~11:42 ("It's a big deal, but it's not the biggest deal."), with "filming" for his "capture".
  close: "Filming is a big deal, but it’s not the biggest deal.",
} as const
