import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"
import { TalkCard } from "@/components/site/WorkCards"
import { StoryHours } from "@/components/site/StoryHours"
import { IS_PRODUCTION } from "@/lib/site-env"
import { FAQ, faqIsUp, showMarkers, showStoryHours, visibleEntries, type FaqEntry } from "@/lib/faq"
import { STORY_HOURS_ARE_SAMS } from "@/lib/story-hours"

// /faq: real questions people have asked OSC, and the answers (Sam, 10/8/26; website-redesign SPEC Feature 4).
// Same design system as every public page: the client site's .cs scope + components/site/site.css. A static
// server component with no client JavaScript: each question is a native <details>, and #1's "where the hours go"
// piece runs on native inputs + CSS (components/site/StoryHours.tsx). The gates live in lib/faq.ts.

export const metadata: Metadata = {
  title: "Questions | Oliver Street Creative",
  description: "Real questions people have asked us about making a video, and our answers.",
  alternates: { canonical: "https://oliverstreetcreative.com/faq" },
}

export default function FaqPage() {
  const env = { production: IS_PRODUCTION }
  if (!faqIsUp(env)) notFound()
  const entries = visibleEntries(FAQ, env)
  const marks = showMarkers(env)

  return (
    <SiteFrame>
      <section className="site-sec">
        <div className="site-in">
          <SectionHead
            as="h1"
            eyebrow="Questions"
            title="Questions people ask us."
            lede="Real questions people have asked us, and our answers."
          />
          {/* DRAFT MARKER - answers awaiting Sam (never in production: lib/faq.ts showMarkers) */}
          {marks ? <span className="cs-pill site-draft">Draft · 10/8/26 · answers awaiting Sam</span> : null}
          <div className="site-faq">
            {entries.map((e, i) => (
              <FaqItem key={e.id} e={e} open={i === 0} marks={marks} hours={showStoryHours(env)} />
            ))}
          </div>
          <TalkCard />
        </div>
      </section>
    </SiteFrame>
  )
}

const STATUS_PILL: Record<FaqEntry["status"], string> = { sam: "Sam’s words", draft: "Draft", open: "Open" }

function FaqItem({ e, open, marks, hours }: { e: FaqEntry; open: boolean; marks: boolean; hours: boolean }) {
  return (
    <details className="site-faq-item" id={e.id} open={open}>
      {/* The row's flex lives on the h2, not the summary: older iOS Safari won't make a <summary> a flex container. */}
      <summary>
        <h2 className="site-faq-row">
          <span className="site-faq-q">
            {e.q}
            {/* staging only: where the answer stands, for Sam's read. Inline after the question so it wraps at 320. */}
            {marks ? <span className={`cs-pill site-faq-st ${e.status}`}>{STATUS_PILL[e.status]}</span> : null}
          </span>
          <svg className="site-faq-chev" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </h2>
      </summary>
      <div className="site-faq-a">
        {e.status === "open" ? <p className="site-faq-open">Answer coming · waiting on Sam</p> : null}
        {e.a.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {e.widget === "story-hours" && hours ? <StoryHours placeholder={!STORY_HOURS_ARE_SAMS} /> : null}
        {(e.after ?? []).map((p) => (
          <p key={p}>{p}</p>
        ))}
        {e.link ? (
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
