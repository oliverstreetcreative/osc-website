import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"
import { TalkCard } from "@/components/site/WorkCards"
import { StoryHours } from "@/components/site/StoryHours"
import {
  FAQ,
  FAQ_PAGE,
  faqIsUp,
  showLink,
  showMarkers,
  showStoryHours,
  siteEnv,
  statusPill,
  visibleEntries,
  type FaqEntry,
  type FaqEnv,
} from "@/lib/faq"
import { STORY_PIECE_APPROVED } from "@/lib/story-hours"

// /faq: real questions people have asked OSC, and the answers (Sam, 10/8/26; website-redesign SPEC Feature 4).
// Same design system as every public page: the client site's .cs scope + components/site/site.css. A static
// server component with no client JavaScript: each question is a native <details>, and #1's "where the hours go"
// piece runs on native inputs + CSS (components/site/StoryHours.tsx). The gates live in lib/faq.ts and fail closed.

// Re-checked hourly at runtime, so a build that couldn't tell where it was running corrects itself (step-2 review).
export const revalidate = 3600

const PAGE_URL = "https://oliverstreetcreative.com/faq"
const DESCRIPTION = "Real questions people have asked us about making a video, and our answers."

export const metadata: Metadata = {
  title: "Questions | Oliver Street Creative",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  // A shared /faq link previews as the FAQ, not the homepage (the layout's openGraph is replaced, so restate the image).
  openGraph: {
    title: "Questions people ask us | Oliver Street Creative",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Oliver Street Creative",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Oliver Street Creative" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Questions people ask us | Oliver Street Creative",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
}

export default function FaqPage() {
  const env = siteEnv()
  if (!faqIsUp(env)) notFound()
  const entries = visibleEntries(FAQ, env)
  const marks = showMarkers(env)

  return (
    <SiteFrame>
      <section className="site-sec">
        <div className="site-in">
          <SectionHead as="h1" eyebrow={FAQ_PAGE.eyebrow} title={FAQ_PAGE.title} lede={FAQ_PAGE.lede} />
          {/* DRAFT MARKER - answers awaiting Sam (never on the live site: lib/faq.ts showMarkers) */}
          {marks ? <span className="cs-pill site-draft">{FAQ_PAGE.draftPill}</span> : null}
          <div className="site-faq">
            {entries.map((e, i) => (
              <FaqItem key={e.id} e={e} open={i === 0} marks={marks} env={env} />
            ))}
          </div>
          <TalkCard />
        </div>
      </section>
    </SiteFrame>
  )
}

function FaqItem({ e, open, marks, env }: { e: FaqEntry; open: boolean; marks: boolean; env: FaqEnv }) {
  return (
    <details className="site-faq-item" id={e.id} open={open}>
      {/* The row's flex lives on the h2, not the summary: older iOS Safari won't make a <summary> a flex container. */}
      <summary>
        <h2 className="site-faq-row">
          <span className="site-faq-q">
            {e.q}
            {/* staging only: where the answer stands, for Sam's read. Inline after the question so it wraps at 320. */}
            {marks ? <span className={`cs-pill site-faq-st ${e.status}`}>{statusPill(e)}</span> : null}
          </span>
          <svg className="site-faq-chev" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </h2>
      </summary>
      <div className="site-faq-a">
        {e.status === "open" ? <p className="site-faq-open">{FAQ_PAGE.openBox}</p> : null}
        {e.a.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {e.widget === "story-hours" && showStoryHours(env) ? <StoryHours draft={!STORY_PIECE_APPROVED} /> : null}
        {(e.after ?? []).map((p) => (
          <p key={p}>{p}</p>
        ))}
        {/* a part still OPEN for Sam's words (staging only: an entry with one is a draft, never on the live site) */}
        {e.openPart && marks ? <p className="site-faq-open">{FAQ_PAGE.openBox}</p> : null}
        {e.link && showLink(e.link, env) ? (
          <p>
            {e.link.lead}{" "}
            <a className="site-link" href={e.link.href} target={e.link.href.endsWith(".pdf") ? "_blank" : undefined} rel="noopener">
              {e.link.label}
            </a>
          </p>
        ) : null}
      </div>
    </details>
  )
}
