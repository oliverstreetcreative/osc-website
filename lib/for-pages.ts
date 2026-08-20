// Curated portfolio pulls for prospective clients (/for/<slug>).
//
// Each page is a hand-picked stack of videos from the library, framed for one
// prospect. Pages are noindexed and unlinked — the URL is the invitation.
// Entries are normally added by the osc-portfolio skill.

export interface ForPage {
  slug: string
  /** the prospect's name as it appears on the page, e.g. "First Financial Bank" */
  prospect: string
  /** optional line under the headline */
  intro?: string
  /** library slugs from lib/work-videos.ts, in the order they appear */
  videoSlugs: string[]
}

export const FOR_PAGES: ForPage[] = [
  {
    slug: "first-financial-bank",
    prospect: "First Financial Bank",
    videoSlugs: [
      "phoenixs-story",
      "widening-the-lens",
      "boone-county-2025",
    ],
  },
]

export function getForPage(slug: string): ForPage | undefined {
  return FOR_PAGES.find((p) => p.slug === slug)
}
