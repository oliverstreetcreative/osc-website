// THE FAQ (/faq). Sam, 10/8/26 ~10:55: "we should have a fun interactive FAQ on the website. And this is the
// question - 'I have an iphone, why don't I just shoot it on that' or something like that."
//
// The questions are REAL ones people asked OSC (mined from mail, Attio and intake, 10/8), generalized so no
// client can be recognised. Who asked what, and where, lives in the website-redesign matter's proposal, never
// in this repo.
//
// status:
//   "sam"   - Sam's own words (or approved by him). The only kind production ever shows.
//   "draft" - written in his register from positions he has stated; waiting for his OK.
//   "open"  - no answer yet; Sam writes it.
// src is a tag for the record (SAM <date> / NEW), never a client name.
//
// THE GATES (lib/faq.test.ts pins them): production renders /faq only when FAQ_PUBLIC, shows only "sam"
// entries, and shows the hours piece only once its hours are Sam's. Staging and local dev show everything,
// with markers. So a wholesale staging -> main merge can't put a draft on the live site.

import { STORY_HOURS_ARE_SAMS } from "./story-hours"

export const FAQ_PUBLIC = false

export type FaqStatus = "sam" | "draft" | "open"

export interface FaqLink {
  lead: string
  label: string
  href: string
}

export interface FaqEntry {
  /** the anchor: /faq#<id> */
  id: string
  q: string
  /** paragraphs before the interactive piece (or the whole answer) */
  a: readonly string[]
  status: FaqStatus
  widget?: "story-hours"
  /** paragraphs after the interactive piece */
  after?: readonly string[]
  link?: FaqLink
  src: string
}

export const FAQ: readonly FaqEntry[] = [
  {
    id: "iphone",
    q: "I have an iPhone. Why don’t I just shoot it on that?",
    a: [
      "You can! The technology is very accessible today. If you have the time and the drive, you can absolutely do this yourself.",
      "Capture is very, very inexpensive today. But crafting a story is still the important part, and it still takes experience, human attention and skill, no matter what tools you’re using.",
    ],
    widget: "story-hours",
    after: ["We’re here for the folks who would rather take it off their plate."],
    link: {
      lead: "Doing it yourself? Here’s a guide we wrote to help you do that:",
      label: "How to shoot a customer testimonial on your iPhone (PDF)",
      href: "/guides/iphone-testimonial-guide.pdf",
    },
    status: "draft",
    src: "Q SAM 10/8 10:55 · ¶1 NEW 'You can!' + SAM 9/24 15:05 · ¶2 SAM 10/8 08:30 · piece NEW (mock v1) · after SAM 9/24 · link lead NEW + SAM 9/24",
  },
  {
    id: "edit-it-ourselves",
    q: "Can you just film it, and we’ll edit it ourselves?",
    a: [
      "Yes, by all means. You get every interview synced, color balanced and cleaned up, ready to drop into whatever editing tool you use.",
    ],
    status: "draft",
    src: "SAM 10/6 email (tool name generalized) · 'by all means' SAM 10/6 call",
  },
  {
    id: "cost",
    q: "How much will it cost?",
    a: [
      "We’ll be able to quote you once we’ve nailed down the scope. We’re full-service from concept to delivery, so the big variables are how much crew, how much shooting, and, if we’re editing, how many minutes of finished video and what level of refinement.",
      "A reference video is the fastest way to anchor it - even a rough one, or something from another company in the ballpark of what you’re going for.",
    ],
    status: "draft",
    src: "SAM 9/30 + 4/2 emails, tidied · ¶2 SAM 4/5 email",
  },
  {
    id: "first-version",
    q: "How long does it take to get a first version?",
    a: [],
    status: "open",
    src: "OPEN: Sam's words needed",
  },
  {
    id: "peoples-time",
    q: "How much of our people’s time does it take?",
    a: ["Plan on about 45 minutes per sit-down. About half an hour of that is the camera actually rolling."],
    status: "sam",
    src: "SAM 10/6 call, tidied",
  },
  {
    id: "length",
    q: "How long should our video be?",
    a: [
      "The first pass is about finding the spine of the video - the right stories in the right order at the right length.",
      "If something needs cutting, it’s easier to tell once there’s music, b-roll and a bit of polish.",
    ],
    status: "sam",
    src: "SAM 7/31 email · ¶2 SAM 8/28 email, tidied",
  },
  {
    id: "changes",
    q: "How many rounds of changes do we get?",
    a: [
      "Changes are unlimited up to the delivery date. After delivery, reopening a project is $500 plus the extra editing.",
      "Some changes are easier than others. Script changes are some of the easiest to make while we’re still on a temporary voice. Changes after we record the real voiceover are some of the hardest.",
    ],
    status: "draft",
    src: "TERMS proposal template · ¶2 SAM 8/6 email, tidied",
  },
  {
    id: "files",
    q: "Can we download it in the size and format we need?",
    a: [
      "Yes. Tell us where it’s going and we’ll export it to fit, like an MP4 under 10 MB for a website.",
      "One thing we can’t do is make it editable in Canva. Animations are built in After Effects, and the master timeline stays in DaVinci Resolve for the color and sound pass.",
    ],
    status: "draft",
    src: "NEW from SAM 10/1 email · ¶2 SAM 9/6 email, tidied",
  },
  {
    id: "reuse",
    q: "Can we use the footage for something else, or share it with a partner?",
    a: [
      "Your license to use the finished video is perpetual, unless we agree otherwise.",
      "Beyond that, the question is what the people on camera agreed to. Their release forms have the answer, and we’ll help you check.",
    ],
    status: "draft",
    src: "TERMS intake form · ¶2 NEW",
  },
]

export interface FaqEnv {
  production: boolean
}

/** Does /faq render here? Everywhere but production until Sam approves it. */
export function faqRenders(env: FaqEnv, isPublic: boolean = FAQ_PUBLIC): boolean {
  return isPublic || !env.production
}

/** Production shows Sam's own answers only; staging and dev show everything, marked. */
export function visibleEntries(entries: readonly FaqEntry[], env: FaqEnv): FaqEntry[] {
  return env.production ? entries.filter((e) => e.status === "sam") : [...entries]
}

/** Is the FAQ up here: rendered, with at least one answer to show? The page, the homepage button and the sitemap
 *  all ask this one question, so a button can never point at a 404 or an empty page. */
export function faqIsUp(env: FaqEnv, entries: readonly FaqEntry[] = FAQ, isPublic: boolean = FAQ_PUBLIC): boolean {
  return faqRenders(env, isPublic) && visibleEntries(entries, env).length > 0
}

/** The hours piece shows in production only once the hours are Sam's real ones. */
export function showStoryHours(env: FaqEnv, hoursAreSams: boolean = STORY_HOURS_ARE_SAMS): boolean {
  return hoursAreSams || !env.production
}

/** Draft and open markers: never in production. */
export function showMarkers(env: FaqEnv): boolean {
  return !env.production
}
