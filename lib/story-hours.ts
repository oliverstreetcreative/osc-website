// "Where the hours go": what goes into a video, by kind. FAQ #1's answer (Sam, 10/8/26 ~10:55: "I like this
// little 'what goes into a video' thing"), adapted from price-estimator's mock v1
// (Matters/price-estimator/concept/story-hours-mock-v1.html). Sam's point (10/8 08:30): capture is very, very
// inexpensive today; crafting the story still takes experience, human attention and skill.
//
// EVERY HOUR BELOW IS A PLACEHOLDER the mock's worker made up. Sam supplies the real ones. Until he does,
// STORY_HOURS_ARE_SAMS stays false and production never shows the piece (lib/faq.ts showStoryHours).
// The step names and sentences are draft copy too (the mock's; Sam hasn't ruled on them).

export const STORY_HOURS_ARE_SAMS = false

export interface StoryStep {
  name: string
  /** one plain sentence, shown when the step is opened */
  why: string
}

export const STEPS: readonly StoryStep[] = [
  { name: "Finding the right person", why: "Picking whose story it is, and why it matters to the people you want to reach." },
  { name: "The pre-interview", why: "A real conversation before the camera is ever on, so we know what’s there." },
  { name: "Planning the questions", why: "The order and the wording that get people talking in their own words." },
  { name: "Logging every minute", why: "Watching all of it and transcribing it, so nothing good gets lost." },
  { name: "Finding the story", why: "Deciding what it’s really about, and what to leave out." },
  { name: "Editing", why: "Cutting an hour of talking down to a couple of minutes that hold together." },
  { name: "Revisions with you", why: "Your notes, our changes, until it’s right." },
]

export type KindKey = "testimonial" | "story" | "bigger"

export interface Kind {
  key: KindKey
  label: string
  /** hours behind the camera on the day(s) */
  filming: number
  /** hours per STEPS entry, same order */
  steps: readonly number[]
}

export const KINDS: readonly Kind[] = [
  { key: "testimonial", label: "Testimonial", filming: 2, steps: [1, 1, 1, 2, 3, 8, 2] },
  { key: "story", label: "A story", filming: 16, steps: [3, 3, 2, 6, 6, 20, 4] },
  { key: "bigger", label: "Bigger", filming: 24, steps: [4, 4, 4, 10, 10, 32, 6] },
]

/** The story work is the sum of its steps: computed, never typed twice. */
export function storyTotal(k: Kind): number {
  return k.steps.reduce((a, b) => a + b, 0)
}

export function hrs(n: number): string {
  return `${n} ${n === 1 ? "hr" : "hrs"}`
}
