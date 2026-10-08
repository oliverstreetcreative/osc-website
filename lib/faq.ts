// THE FAQ (/faq). Sam, 10/8/26 ~10:55: "we should have a fun interactive FAQ on the website. And this is the
// question - 'I have an iphone, why don't I just shoot it on that' or something like that."
//
// The questions are REAL ones people asked OSC (mined from mail, Attio and intake, 10/8), generalized so no
// client can be recognised. Who asked what, and where, lives in the website-redesign matter's proposal, never
// in this repo.
//
// status (step-2 review, 10/8: "his words" is not "his OK"):
//   "approved" - Sam OK'd this exact text for the live site (approvedOn = the date he did). The only kind production
//                ever shows.
//   "draft"    - waiting for his OK. `words: "sam"` marks a draft that is his own words, tidied (from an email or a call).
//   "open"     - no answer yet; Sam writes it.
// src is a tag for the record (SAM <date> / TERMS / SITE / NEW / OPEN), never a client name.
//
// THE GATES (lib/faq.test.ts pins them). They FAIL CLOSED: drafts and markers show only where the site positively
// knows it's staging (Railway's env, read at build) or local `next dev`. Anything else - including a production build
// that can't tell what it is - is treated as the live site, where /faq renders only when FAQ_PUBLIC, shows only
// approved entries, shows the hours piece only once STORY_PIECE_APPROVED, and links the iPhone guide only once
// GUIDE_IS_FINAL. So a wholesale staging -> main merge can't put a draft on the live site.

import { IS_STAGING } from "./site-env"
import { STORY_PIECE_APPROVED } from "./story-hours"

export const FAQ_PUBLIC = false
/** public/guides/iphone-testimonial-guide.pdf is still "Working draft (PRELIM7)"; the live site doesn't link it until final. */
export const GUIDE_IS_FINAL = false

/** Words on the page around the questions (NEW, 10/8; Sam OKs them with the page). */
export const FAQ_PAGE = {
  eyebrow: "FAQ",
  title: "Questions people ask us.",
  lede: "Real ones, with our answers.",
  draftPill: "Draft · 10/8/26 · answers awaiting Sam",
  openBox: "Answer coming · waiting on Sam",
  pill: { approved: "Approved", draftSam: "Draft · Sam’s words", draft: "Draft", open: "Open" },
} as const

export type FaqStatus = "approved" | "draft" | "open"

export interface FaqLink {
  lead: string
  label: string
  href: string
  /** the linked file is itself a draft: the live site hides the link until it's final */
  draftFile?: boolean
}

export interface FaqEntry {
  /** the anchor: /faq#<id> */
  id: string
  q: string
  /** paragraphs before the interactive piece (or the whole answer) */
  a: readonly string[]
  status: FaqStatus
  /** YYYY-MM-DD Sam approved it; required when status is "approved" */
  approvedOn?: string
  /** the answer is Sam's own words, tidied */
  words?: "sam"
  widget?: "story-hours"
  /** paragraphs after the interactive piece */
  after?: readonly string[]
  link?: FaqLink
  /** a part of the answer still OPEN for Sam's words: staging shows the "Answer coming" box after the paragraphs.
   *  An approved entry never has one (lib/faq.test.ts). */
  openPart?: string
  src: string
}

export const FAQ: readonly FaqEntry[] = [
  {
    id: "iphone",
    q: "I have an iPhone. Why don’t I just shoot it on that?",
    a: [
      "You can! The technology is very accessible today. If you have the time and the drive, you can absolutely do this yourself.",
      "Capture is very, very inexpensive today. But crafting a story is still the important part, and still requires experience and human attention and skill, no matter what tools you’re using.",
    ],
    widget: "story-hours",
    after: ["We’re here for the folks who would rather take it off their plate."],
    link: {
      lead: "Doing it yourself? Here’s a guide we wrote to help you do that:",
      label: "How to shoot a customer testimonial on your iPhone (PDF)",
      href: "/guides/iphone-testimonial-guide.pdf",
      draftFile: true,
    },
    status: "draft",
    src: "Q SAM 10/8 10:55 · ¶1 NEW 'You can!' + SAM 9/24 15:05 · ¶2 SAM 10/8 08:30 (punctuation only) · piece NEW (mock v1) · after SAM 9/24 · link lead NEW + SAM 9/24",
  },
  {
    id: "edit-it-ourselves",
    q: "Can you just film it, and we’ll edit it ourselves?",
    a: [
      "Yes, by all means. You get every interview synced, color balanced and cleaned up, ready to drop into whatever editing tool you use.",
    ],
    status: "draft",
    words: "sam",
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
    words: "sam",
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
    status: "draft",
    words: "sam",
    src: "SAM 10/6 call, tidied",
  },
  {
    id: "length",
    q: "How do you decide how long the video should be?",
    a: [
      "The first pass is about finding the spine of the video - the right stories in the right order at the right length.",
      "If something needs cutting, it’s easier to tell once there’s music, b-roll and a bit of polish.",
    ],
    status: "draft",
    words: "sam",
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
    a: ["Your license to use the finished video is perpetual, unless we agree otherwise."],
    // The step-4 review (10/8) cut a NEW ¶2 that promised help on a rights question Sam hasn't answered.
    openPart: "What the people on camera agreed to (their release forms), and what OSC does about it: Sam's words",
    status: "draft",
    src: "TERMS intake form · ¶2 OPEN (Sam's words needed)",
  },
]

export interface FaqEnv {
  /** treat this deployment as the live site */
  production: boolean
}

/** Drafts and markers are allowed only where the site positively knows it's staging or local dev (fail closed). */
export function draftsAllowed(staging: boolean = IS_STAGING, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return staging || nodeEnv === "development"
}

/** This deployment, as the FAQ sees it: anything not positively staging/dev is the live site. */
export function siteEnv(): FaqEnv {
  return { production: !draftsAllowed() }
}

/** Does /faq render here? Everywhere drafts are allowed; on the live site only once Sam approves the page. */
export function faqRenders(env: FaqEnv, isPublic: boolean = FAQ_PUBLIC): boolean {
  return isPublic || !env.production
}

/** The live site shows approved answers only; staging and dev show everything, marked. */
export function visibleEntries(entries: readonly FaqEntry[], env: FaqEnv): FaqEntry[] {
  return env.production ? entries.filter((e) => e.status === "approved") : [...entries]
}

/** Is the FAQ up here: rendered, with at least one answer to show? The page, the homepage button and the sitemap
 *  all ask this one question, so a button can never point at a 404 or an empty page. */
export function faqIsUp(env: FaqEnv, entries: readonly FaqEntry[] = FAQ, isPublic: boolean = FAQ_PUBLIC): boolean {
  return faqRenders(env, isPublic) && visibleEntries(entries, env).length > 0
}

/** The hours piece shows on the live site only once Sam has OK'd all of it: hours, steps, labels, switch lines. */
export function showStoryHours(env: FaqEnv, pieceApproved: boolean = STORY_PIECE_APPROVED): boolean {
  return pieceApproved || !env.production
}

/** A link to a file that's itself a draft shows on the live site only once the file is final. */
export function showLink(link: FaqLink, env: FaqEnv, guideIsFinal: boolean = GUIDE_IS_FINAL): boolean {
  return !link.draftFile || guideIsFinal || !env.production
}

/** Draft and open markers: never on the live site. */
export function showMarkers(env: FaqEnv): boolean {
  return !env.production
}

/** The staging pill for an entry. */
export function statusPill(e: FaqEntry): string {
  if (e.status === "approved") return FAQ_PAGE.pill.approved
  if (e.status === "open") return FAQ_PAGE.pill.open
  return e.words === "sam" ? FAQ_PAGE.pill.draftSam : FAQ_PAGE.pill.draft
}
