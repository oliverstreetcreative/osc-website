import type { CSSProperties } from "react"
import Link from "next/link"
import { WORK_VIDEOS, type WorkVideo } from "@/lib/work-videos"
import { HERO_REEL, heroReelSources, posterSet } from "@/lib/hero-reel"
import { creditsFrom, fetchTmdbBundle, type Credit } from "@/lib/tmdb"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"
import { HeroReel } from "@/components/site/HeroReel"
import { MuxFacade } from "@/components/site/MuxFacade"
import { SiteMotion } from "@/components/site/SiteMotion"
import { PlayBadge } from "@/app/client/ui"
import { GUIDE_IS_FINAL, draftsAllowed, faqIsUp, siteEnv } from "@/lib/faq"
import { HOME } from "@/lib/home-copy"

// ---------------------------------------------------------------------------
// THE HOMEPAGE, rebuilt on staging around Sam's positioning (10/8/26 ~11:05: "we're
// humble storytellers in an age of endless content"; website-redesign SPEC
// Feature 5). Same design system as the client site and every public page.
//
// The words are Sam's own: the tagline (9/23) as the headline and pitch A under it
// (his 10/7 22:45 ruling), his 10/8 voice memo for content vs story and the DIY
// invitation, and the approved 9/27 copy for the pillars, work and quotes. They all
// live in lib/home-copy.ts with their sources. Humility is shown, never claimed:
// the page never calls OSC humble.
//
// The page is a server component. The only client JavaScript is the hero reel's
// play/pause; the film credits render on the server (lib/tmdb.ts).
// ---------------------------------------------------------------------------

export const revalidate = 86400 // film credits refresh daily

type PillarKey = "move-hearts" | "open-minds" | "build-trust"

interface Pillar {
  key: PillarKey
  label: string
  what: string
  /** slugs from WORK_VIDEOS: public /work/ pages only */
  workSlugs: string[]
  quote: { text: string; name: string; title: string }
  note?: string
}

// The three clauses of the tagline, mapped to what OSC actually does and to work
// that is already public. The quotes are the same three that were on the old
// homepage: no new client words.
const PILLARS: Pillar[] = [
  {
    key: "move-hearts",
    label: "Move hearts",
    what: "Fundraising and nonprofit story films",
    workSlugs: ["phoenixs-story", "janells-story"],
    quote: {
      text: "The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate.",
      name: "Jordan Huizinga",
      title: "VP of Development, Beech Acres",
    },
  },
  {
    key: "open-minds",
    label: "Open minds",
    what: "Campaigns, advocacy and education",
    workSlugs: [],
    quote: {
      text: "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street.",
      name: "Al Haehnle",
      title: "Director, Landslide Films",
    },
    note: "Sample campaign, advocacy and education work available by request.",
  },
  {
    key: "build-trust",
    label: "Build trust",
    what: "Testimonials, brand and commercial films",
    workSlugs: ["boone-county-2025"],
    quote: {
      text: "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise.",
      name: "Louis Kelly",
      title: "Boone County Prosecutor",
    },
  },
]

// Homepage copy, plain-language pass (Jesse Dacri's claudespeak note 9/27; Sam
// approved it outright 22:35). Written through sam-voice. Unchanged by the rebuild.
const HOME_COPY = {
  pillarsH2: "What we make.",
  pillarsLede: "We make three kinds of videos. Here’s each one, with work to show for it.",
  "body:move-hearts":
    "The video that plays at your gala or fundraising breakfast, right before people decide whether to give.",
  "body:open-minds": "Campaign spots and videos for causes and schools, made to change what people think.",
  "body:build-trust":
    "Your customers, or you, on camera talking honestly about the work. We shoot it so they sound like themselves.",
  workH2: "Some of our work.",
} as const

const BOOK = "https://cal.com/oliverstreetcreative"
const TESTIMONIAL_REEL = "4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28"
const GUIDE = "/guides/iphone-testimonial-guide.pdf"

const PILLAR_BY_SLUG: Record<string, Pillar> = Object.fromEntries(
  PILLARS.flatMap((p) => p.workSlugs.map((s) => [s, p])),
)

function still(playbackId: string, time: number, width: number) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&time=${time}`
}

async function loadCredits(): Promise<Credit[]> {
  try {
    return creditsFrom(await fetchTmdbBundle(86400))
  } catch (error) {
    console.error("TMDB credits unavailable:", error)
    return []
  }
}

export default async function HomePage() {
  const credits = await loadCredits()
  const work = (slugs: string[]) =>
    slugs.map((s) => WORK_VIDEOS.find((v) => v.slug === s)).filter((v): v is WorkVideo => Boolean(v))
  // The DIY screen's two resources, each behind its own gate (lib/faq.ts, fail closed). With neither, no screen.
  const showFaq = faqIsUp(siteEnv())
  const showGuide = GUIDE_IS_FINAL || draftsAllowed()

  return (
    <SiteFrame>
      {/* The microsites' subtle motion (Sam 10/8 ~12:02; the silo page's, which he picked 9/24): each block settles in
          as it scrolls up, and a thin bar on the right edge fills as you read. CSS does it where scroll-driven
          animation exists; SiteMotion is the fallback elsewhere. Reduced motion turns both off. */}
      <div className="site-prog" aria-hidden="true">
        <i id="site-prog" />
      </div>
      <SiteMotion />

      {/* 1 · HERO: the reel, the tagline (Sam's headline, 10/7) and its supporting line */}
      <section className="site-hero" aria-labelledby="hero-title">
        <HeroReel poster={posterSet(HERO_REEL.poster)} sources={heroReelSources(HERO_REEL)} />
        <div className="site-hero-in">
          <div className="cs-eyebrow">{HOME.heroEyebrow.t}</div>
          <h1 id="hero-title">
            <span className="sr-only">{HOME.heroSr.t}</span>
            <span aria-hidden="true">
              Stories that move hearts, open minds, and <em>build trust.</em>
            </span>
          </h1>
          <p className="site-lede">{HOME.heroSub.t}</p>
          <div className="site-act">
            <a className="cs-btn light lg" href={BOOK} target="_blank" rel="noopener noreferrer">
              Book a call
            </a>
            <a className="cs-btn on-ink lg" href="#work">
              See the work
            </a>
          </div>
        </div>
      </section>

      {/* 2 · THE PITCH that follows the headline (Sam 10/7 22:45: "A is the pitch that follows") */}
      <section id="pitch" className="site-sec white">
        <div className="site-in r">
          <p className="site-pitch">{HOME.pitch.t}</p>
          {/* DRAFT MARKER: the rebuilt page's copy awaits Sam (shown wherever the page renders, like the old thesis pill) */}
          <span className="cs-pill site-draft">{HOME.draftPill.t}</span>
        </div>
      </section>

      {/* 3 · SAM'S INTRO VIDEO: a placeholder until he shoots it (Sam 10/8 ~11:05: "Put a placeholder for the video") */}
      <section id="from-sam" className="site-sec ink">
        <div className="site-in r">
          <SectionHead eyebrow={HOME.videoEyebrow.t} title={HOME.videoH2.t} />
          <div className="site-tbd" role="img" aria-label={`Video placeholder: ${HOME.videoLabel.t}`}>
            <span>{HOME.videoLabel.t}</span>
            <PlayBadge />
          </div>
        </div>
      </section>

      {/* 4 · CONTENT VS STORY: Sam's 10/8 voice memo, under his 10/7 line */}
      <section id="story" className="site-sec">
        <div className="site-in r">
          <SectionHead title={HOME.storyH2.t} />
          <div className="site-prose">
            {HOME.story.map((p) => (
              <p key={p.t}>{p.t}</p>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · WHAT WE MAKE: Sam's line, then the tagline's three clauses, each backed by public work */}
      <section id="what-we-make" className="site-sec white">
        <div className="site-in r">
          <SectionHead eyebrow="What we do" title={HOME_COPY.pillarsH2} lede={HOME.whatWeDo.t} />
          <p className="site-lede site-lede-2">{HOME_COPY.pillarsLede}</p>
          <div className="site-grid3">
            {PILLARS.map((p) => {
              const films = work(p.workSlugs)
              return (
                <article key={p.key} className="cs-card site-pillar">
                  <div className="cs-eyebrow">{p.what}</div>
                  <h3>{p.label}.</h3>
                  <p>{HOME_COPY[`body:${p.key}`]}</p>
                  {films.length > 0 ? (
                    <div className="site-minis">
                      <div className="cs-eyebrow site-minis-label">The work</div>
                      {films.map((v) => (
                        <Link key={v.slug} href={`/work/${v.slug}`} className="site-mini">
                          <img src={still(v.playbackId, v.thumbTime, 320)} alt="" loading="lazy" />
                          <span>
                            <strong>{v.title}</strong>
                            <small>{v.client}</small>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {p.note ? (
                    <p className="site-note">
                      <a className="site-link" href="#contact">
                        {p.note}
                      </a>
                    </p>
                  ) : null}
                  <blockquote className="site-quote">
                    <p>&ldquo;{p.quote.text}&rdquo;</p>
                    <div className="site-cite">
                      <b>{p.quote.name}</b>
                      <span>{p.quote.title}</span>
                    </div>
                  </blockquote>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* 6 · THE WORK: ink, because this is what you watch */}
      <section id="work" className="site-sec ink">
        <div className="site-in r">
          <SectionHead eyebrow="Work" title={HOME_COPY.workH2} lede={<>A few of the films we&rsquo;ve made.</>} />
          <div className="site-posters">
            {WORK_VIDEOS.map((v) => {
              const pillar = PILLAR_BY_SLUG[v.slug]
              return (
                <Link key={v.slug} href={`/work/${v.slug}`} className="site-pcard">
                  <div className="cs-poster">
                    {/* alt="": the title is right below, inside the same link */}
                    <img src={still(v.playbackId, v.thumbTime, 960)} alt="" loading="lazy" />
                    {pillar ? <span className="cs-poster-tag">{pillar.label}</span> : null}
                    <PlayBadge />
                  </div>
                  <div className="cs-pcard-body">
                    <h3>{v.title}</h3>
                    <p>{v.client}</p>
                    <div className="site-logo-row">
                      <img src={v.clientLogo} alt="" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          <p className="site-more">
            <a className="site-link" href="#contact">
              More sample work available by request
            </a>
            .
          </p>
        </div>
      </section>

      {/* 7 · EVERYBODY'S A FILMMAKER: DIY, encouraged, never discouraged (Sam 10/8) */}
      {showFaq || showGuide ? (
        <section id="diy" className="site-sec">
          <div className="site-in r">
            <SectionHead title={HOME.diyH2.t} lede={HOME.diyBody.t} />
            <ul className="site-res">
              {showFaq ? (
                <li>
                  <Link className="site-link" href="/faq">
                    {HOME.diyFaq.t}
                  </Link>
                </li>
              ) : null}
              {showGuide ? (
                <li>
                  <a className="site-link" href={GUIDE} target="_blank" rel="noopener">
                    {HOME.diyGuide.t}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 8 · TESTIMONIALS: the same three real quotes, the same film */}
      <section id="testimonials" className="site-sec white">
        <div className="site-in r">
          <SectionHead
            eyebrow="Testimonials"
            title="People like working with us."
            lede={<>Here&rsquo;s what a few of our clients said about working with us.</>}
          />
          <div className="site-feature">
            <MuxFacade
              src={`https://player.mux.com/${TESTIMONIAL_REEL}?accent-color=%23E07830&start=93&thumbnail_time=93&poster=${encodeURIComponent(still(TESTIMONIAL_REEL, 93, 1280))}`}
              poster={still(TESTIMONIAL_REEL, 93, 1280)}
              title="Our clients on working with Oliver Street Creative"
            />
            <blockquote>
              <p>
                &ldquo;The partnership with Oliver Street Creative was so valuable in understanding our goals and our values
                and the mission and impact that we wanted to communicate.&rdquo;
              </p>
              <div className="site-cite">
                <b>Jordan Huizinga</b>
                <span>VP of Development</span>
                <img src="/client-logos/beech-acres-logo.png" alt="Beech Acres" />
              </div>
            </blockquote>
          </div>
          <div className="site-quotes">
            <figure className="cs-card site-qcard">
              <p>
                &ldquo;It comes down to content, creativity, creative editing, and storytelling. That&rsquo;s what
                separates the crowd from working with Oliver Street.&rdquo;
              </p>
              <figcaption className="site-cite">
                <b>Al Haehnle</b>
                <span>Director, Landslide Films</span>
                <img src="/client-logos/landslide-films-logo.png" alt="Landslide Films" />
              </figcaption>
            </figure>
            <figure className="cs-card site-qcard">
              <p>
                &ldquo;Oliver Street brought a level of depth and soul to our production that we wouldn&rsquo;t have had
                otherwise.&rdquo;
              </p>
              <figcaption className="site-cite">
                <b>Louis Kelly</b>
                <span>Boone County Prosecutor</span>
                <img src="/client-logos/boone-county-logo-white-text.png" alt="Boone County" />
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 9 · WHY US, opened by the film credits (Sam 10/8 ~12:02: 'the movie credits should begin a "why us" ... we're
          serious filmmakers, we're a nimble operation, and we're humble'). The posters drift slowly, posters only
          (his words: "just the posters"). A hover, a focus or the pause control stops them, and reduced motion turns
          the drift back into a swipe row. The second copy of the row only closes the loop: hidden from screen
          readers and out of the tab order. */}
      <section id="why-us" className="site-sec ink">
        <div className="site-in r">
          <SectionHead eyebrow={HOME.whyEyebrow.t} title={HOME.whyH2.t} lede={HOME.whyLede.t} />
        </div>
        {credits.length > 0 ? (
          <div className="site-drift" role="region" aria-label={HOME.creditsLabel.t}>
            <label className="site-drift-pause">
              <input type="checkbox" />
              <span>{HOME.drift.t}</span>
            </label>
            <div className="site-drift-track" style={{ "--n": credits.length } as CSSProperties}>
              {[0, 1].map((copy) =>
                credits.map((c) => (
                  <a
                    key={`${copy}-${c.key}`}
                    className={copy === 1 ? "site-drift-poster dup" : "site-drift-poster"}
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-hidden={copy === 1 ? true : undefined}
                    tabIndex={copy === 1 ? -1 : undefined}
                    title={c.title}
                  >
                    {c.poster ? (
                      <img src={c.poster} alt={copy === 1 ? "" : c.title} loading="lazy" />
                    ) : (
                      <span className="ph">{c.title}</span>
                    )}
                  </a>
                )),
              )}
            </div>
          </div>
        ) : null}
        <div className="site-in r">
          <div className="site-why">
            <div>
              <h3>{HOME.whyNimble.t}</h3>
              <p className="site-open-mark">{HOME.whyOpen.t}</p>
            </div>
            <div>
              <h3>{HOME.whyHumble.t}</h3>
              <p className="site-open-mark">{HOME.whyOpen.t}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 10 · CONTACT: Sam's 10/8 close */}
      <section id="contact" className="site-sec">
        <div className="site-in r">
          <div className="site-contact">
            <div>
              <div className="cs-eyebrow">{HOME.closeEyebrow.t}</div>
              <h2 className="site-h2" style={{ marginTop: 14 }}>
                {HOME.closeH2.t}
              </h2>
              <p className="site-lede">{HOME.closeLede.t}</p>
              <p className="site-lede">{HOME.closeBody.t}</p>
              <div className="site-act">
                <a className="cs-btn light lg" href={BOOK} target="_blank" rel="noopener noreferrer">
                  Schedule free consultation
                </a>
                {/* The FAQ (Sam 10/8): only where /faq is up - never on the live site before Sam approves it (fails closed) */}
                {showFaq ? (
                  <Link className="cs-btn on-ink lg" href="/faq">
                    Read the FAQ
                  </Link>
                ) : null}
              </div>
            </div>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href="mailto:hello@oliverstreetcreative.com">hello@oliverstreetcreative.com</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href="tel:+18595121419">(859) 512-1419</a>
                </dd>
              </div>
              <div>
                <dt>Studio</dt>
                <dd>
                  521 Oliver St
                  <br />
                  Covington, KY 41014
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </SiteFrame>
  )
}
