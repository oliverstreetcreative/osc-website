import Link from "next/link"
import { WORK_VIDEOS, type WorkVideo } from "@/lib/work-videos"
import { HERO_REEL, heroReelSources } from "@/lib/hero-reel"
import { creditsFrom, fetchTmdbBundle, type Credit } from "@/lib/tmdb"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"
import { HeroReel } from "@/components/site/HeroReel"
import { MuxFacade } from "@/components/site/MuxFacade"
import { PlayBadge } from "@/app/client/ui"

// ---------------------------------------------------------------------------
// THE HOMEPAGE, restyled in the hub's vein (Sam, 10/3/26 01:20: "I'm loving the
// hub so much, I think it might be right to redesign the website, at least on
// staging, in this vein"). Same design system as the client site: paper and ink,
// white cards, big confident type, orange only where it means something, phone
// first, one idea per screen.
//
// The MESSAGE is unchanged and ruled by Sam: the tagline (9/23), the thesis
// (sam-voice draft v3, still marked DRAFT), the three pillars (9/23), the copy
// pass (9/27). Every film and quote is real and already public.
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
// approved it outright 22:35). Written through sam-voice. Unchanged by the restyle.
const HOME_COPY = {
  pillarsH2: "What we make.",
  pillarsLede: "We make three kinds of videos. Here’s each one, with work to show for it.",
  "body:move-hearts":
    "The video that plays at your gala or fundraising breakfast, right before people decide whether to give.",
  "body:open-minds": "Campaign spots and videos for causes and schools, made to change what people think.",
  "body:build-trust":
    "Your customers, or you, on camera talking honestly about the work. We shoot it so they sound like themselves.",
  workH2: "Some of our work.",
  creditsH2: "We come from the movie business.",
  contactBody:
    "Book a free call and tell us what you need. We’ll tell you how we’d shoot it and what it would cost.",
} as const

const BOOK = "https://cal.com/oliverstreetcreative"
const TESTIMONIAL_REEL = "4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28"

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
  const reel = heroReelSources(HERO_REEL)
  const work = (slugs: string[]) =>
    slugs.map((s) => WORK_VIDEOS.find((v) => v.slug === s)).filter((v): v is WorkVideo => Boolean(v))

  return (
    <SiteFrame>
      {/* 1 · HERO: the reel, and the tagline over it */}
      <section className="site-hero" aria-labelledby="hero-title">
        <HeroReel poster={HERO_REEL.poster} mp4={reel.mp4} hls={reel.hls} />
        <div className="site-hero-in">
          {/* "Video production" added 10/3: with only a still on screen, the visible first
              screen never said what OSC makes (adversarial review finding 11). */}
          <div className="cs-eyebrow">Video production · Covington, KY</div>
          <h1 id="hero-title">
            <span className="sr-only">
              Oliver Street Creative — stories that move hearts, open minds, and build trust. Video production in
              Cincinnati &amp; Covington, KY.
            </span>
            <span aria-hidden="true">
              Stories that move hearts, open minds, and <em>build trust.</em>
            </span>
          </h1>
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

      {/* 2 · WHY TRUST: the thesis (sam-voice draft v3, not yet approved by Sam) */}
      <section id="why-trust" className="site-sec white">
        <div className="site-in">
          <SectionHead eyebrow="Why trust" title={<>Your brand doesn&rsquo;t need content. It needs trust.</>} />
          <div className="site-prose">
            <p>
              Screens aren&rsquo;t going anywhere. More and more of how we meet people, hire people, give to causes, and
              decide who to trust happens through a screen. And now anyone can make &ldquo;content.&rdquo; AI can make it
              by the truckload, for free.
            </p>
            <p>But content isn&rsquo;t what moves people. Trust is. People have to believe you.</p>
            <p>
              That happens when a real person comes through the screen - a customer, a founder, a family your work
              helped. Getting that to come through takes craft. Knowing what to ask, when to stop talking, how to light a
              face so it looks like a person and not an ad, and how to cut it so it still sounds like them.
            </p>
            <p>It&rsquo;s not flashy. It&rsquo;s good, honest work. That&rsquo;s what we do.</p>
          </div>
          {/* DRAFT MARKER: thesis copy is sam-voice draft v3 (2026-09-23), not yet approved by Sam */}
          <span className="cs-pill site-draft">Draft copy · v3 · 9/23/26 · awaiting Sam</span>
        </div>
      </section>

      {/* 3 · WHAT WE MAKE: the tagline's three clauses, each backed by public work */}
      <section id="what-we-make" className="site-sec">
        <div className="site-in">
          <SectionHead eyebrow="What we do" title={HOME_COPY.pillarsH2} lede={HOME_COPY.pillarsLede} />
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

      {/* 4 · THE WORK: ink, because this is what you watch */}
      <section id="work" className="site-sec ink">
        <div className="site-in">
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

      {/* 5 · TESTIMONIALS: the same three real quotes, the same film */}
      <section id="testimonials" className="site-sec">
        <div className="site-in">
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

      {/* 6 · FILM CREDITS: the craft has a paper trail */}
      {credits.length > 0 ? (
        <section id="credits" className="site-sec ink">
          <div className="site-in">
            <SectionHead
              eyebrow="Film credits"
              title={HOME_COPY.creditsH2}
              lede={<>We&rsquo;ve spent years working on Hollywood film sets. These are some of the movies and shows.</>}
            />
          </div>
          <div className="site-strip">
            {credits.map((c) => (
              <a key={c.key} className="site-credit" href={c.href} target="_blank" rel="noopener noreferrer">
                {c.poster ? <img src={c.poster} alt="" loading="lazy" /> : <span className="ph">{c.title}</span>}
                <b>{c.title}</b>
                <small>
                  {[c.year, c.jobs.join(", ")].filter(Boolean).join(" · ")}
                </small>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7 · CONTACT */}
      <section id="contact" className="site-sec">
        <div className="site-in">
          <div className="site-contact">
            <div>
              <div className="cs-eyebrow">Get started</div>
              <h2 className="site-h2" style={{ marginTop: 14 }}>
                Let&rsquo;s make something together.
              </h2>
              <p className="site-lede">{HOME_COPY.contactBody}</p>
              <div className="site-act">
                <a className="cs-btn light lg" href={BOOK} target="_blank" rel="noopener noreferrer">
                  Schedule free consultation
                </a>
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
