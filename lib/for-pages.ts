// Curated portfolio pulls for prospective clients (/for/<slug>).
//
// Each page is a hand-picked stack of videos from the library, framed for one
// prospect. Pages are noindexed and unlinked — the URL is the invitation.
// Entries are normally added by the osc-portfolio skill.

/**
 * A proposal, rendered as a mini-site on the prospect's /for/ page.
 *
 * When a ForPage carries one, the page stops being "selected work" and becomes
 * the proposal itself: a headline that speaks to the prospect's need, the pitch,
 * work chosen for that need, the scope, the number, and a way to say yes (or to
 * say what needs to move). Same copy as the PDF — the PDF is the record, this
 * is the impression. Authored by the osc-propose / osc-portfolio skills.
 */
export interface ForProposal {
  /** e.g. "The church is done. Now let it sell the next one." */
  headline: string
  /** one italic serif line under the headline — the "close deals" voice */
  hook?: string
  /** "Andrew Powers, Cincinnati Painting Co" */
  preparedFor?: string
  /** "September 6, 2026" */
  date?: string
  /** the pitch — paragraphs */
  overview: string[]
  /** named sections, each a lead paragraph and/or bullets ("**Lead.** rest" bolds the lead) */
  sections?: { title: string; lead?: string; bullets?: string[] }[]
  /** intro line above the video stack, e.g. "Work like what you're after" */
  workTitle?: string
  workIntro?: string
  deliverables?: { item: string; detail?: string; use?: string }[]
  timeline?: { when: string; what: string }[]
  investment: {
    amount: string            // "$3,875"
    standardRate?: string     // "$7,760" — struck through
    label?: string            // "direct-client rate"
    intro?: string            // what the price covers
    note?: string             // payment terms
  }
  /** optional add-ons, shown as cards after the number */
  options?: { title: string; price: string; body: string }[]
  terms?: string[]
  cta?: {
    /** portal proposal URL once one is published; the primary "Accept" button */
    acceptUrl?: string
    /** mailto or cal.com link for "let's do it" when there is no portal proposal yet */
    yesUrl?: string
    yesLabel?: string
    /** the easy counter-offer: "tell me what needs to move" */
    changesUrl?: string
    changesLabel?: string
    /** a scheduling link */
    callUrl?: string
  }
  validUntil?: string
}

export interface ForPage {
  slug: string
  /** the prospect's name as it appears on the page, e.g. "First Financial Bank" */
  prospect: string
  /** path under /public, e.g. "/prospect-logos/first-financial-bank-logo.png" */
  prospectLogo?: string
  /** true when the logo file is already white/light (skip the invert filter) */
  isLightLogo?: boolean
  /** true when the logo artwork contains the prospect's name, so the headline drops the text */
  logoIncludesName?: boolean
  /** optional line under the headline */
  intro?: string
  /** library slugs from lib/work-videos.ts, in the order they appear */
  videoSlugs: string[]
  /** when present, the page renders as a proposal mini-site (see ForProposal) */
  proposal?: ForProposal
}

export const FOR_PAGES: ForPage[] = [
  {
    slug: "first-financial-bank",
    prospect: "First Financial Bank",
    prospectLogo: "/prospect-logos/first-financial-bank-logo.png",
    logoIncludesName: true,
    videoSlugs: [
      "phoenixs-story",
      "widening-the-lens",
      "boone-county-2025",
    ],
  },
  {
    slug: "horizon",
    prospect: "Horizon Community Foundation",
    prospectLogo: "/prospect-logos/horizon-community-foundation-logo-white.png",
    isLightLogo: true,
    logoIncludesName: true,
    videoSlugs: ["phoenixs-story", "janells-story"],
  },
]

export function getForPage(slug: string): ForPage | undefined {
  return FOR_PAGES.find((p) => p.slug === slug)
}
