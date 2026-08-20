// Curated portfolio pulls for prospective clients (/for/<slug>).
//
// Each page is a hand-picked stack of videos from the library, framed for one
// prospect. Pages are noindexed and unlinked — the URL is the invitation.
// Entries are normally added by the osc-portfolio skill.

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
    prospect: "Horizon Community Funds",
    prospectLogo: "/prospect-logos/horizon-community-funds-logo-white.png",
    isLightLogo: true,
    videoSlugs: ["phoenixs-story", "janells-story"],
  },
]

export function getForPage(slug: string): ForPage | undefined {
  return FOR_PAGES.find((p) => p.slug === slug)
}
