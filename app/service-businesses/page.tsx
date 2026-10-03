import type { Metadata } from "next"
import { WORK_VIDEOS, type WorkVideo } from "@/lib/work-videos"
import { FROM_PRICE, FROM_PRICE_LINE } from "@/lib/silo-offer"
import { SiteFrame } from "@/components/site/SiteFrame"
import { HeroReel } from "@/components/site/HeroReel"
import { SiteMotion } from "@/components/site/SiteMotion"
import { MuxFacade } from "@/components/site/MuxFacade"
import { PlayBadge } from "@/app/client/ui"

// ---------------------------------------------------------------------------
// /service-businesses - the first silo page, and the template for the rest.
//
// Unlisted: not in the nav, not linked from the homepage, no sibling-silo
// links. Links out only to home, work and contact. A scroll pitch in the
// Holmes stadium beats (Sales/packets/service-business-testimonial-pitch-
// packet.md): the market truth for this buyer, what it means for them, proof
// from real OSC work, then the invitation. One idea per screen.
//
// RESTYLED 10/3/26 in the hub's vein (Sam 01:20): the same design system as
// the homepage and the client site (components/site/site.css on top of
// app/client/client.css). Paper screens for reading, ink for video, the big
// numbers in the shoot-day hub's condensed face. The words, the order and the
// motion (Sam picked it 9/24) are unchanged.
//
// Copy is DRAFT, in Sam's register (sam-voice). Every number is a graded,
// verified fact from the packet (§3) with its primary linked on the page.
// Nothing here is invented: the quotes are none, the work is real, the
// "what not to buy" lines are Sam's own from the Cincinnati Painting Co
// proposal (9/6/26).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "The referral you can replay | Oliver Street Creative",
  description:
    "Customer testimonial videos for painters, roofers, remodelers and the trades in Cincinnati and Northern Kentucky. We film your happiest customer at the finished job.",
  alternates: { canonical: "https://oliverstreetcreative.com/service-businesses" },
  openGraph: {
    title: "The referral you can replay",
    description: "We film your happiest customer at the finished job, saying what they'd tell a neighbor.",
    url: "https://oliverstreetcreative.com/service-businesses",
    siteName: "Oliver Street Creative",
    type: "website",
  },
}

// The proof: the same three pieces Sam picked for the Cincinnati Painting Co
// pull (9/6/26). Two are public /work/ pages; the client reel is unlisted on
// Mux and plays in place.
const REEL = {
  title: "What our clients say",
  client: "Oliver Street Creative clients, 2025",
  playbackId: "SdJJyMVRubqn57A2hcrcy5glQoB82bHsfbNrMnLLfm00",
  thumbTime: 110,
}
const PROOF_SLUGS = ["phoenixs-story", "boone-county-2025"]

function thumb(playbackId: string, time: number, width = 960) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&time=${time}`
}

// Motion: CSS does the settle-in and the progress bar wherever scroll-driven
// animations exist (current iOS Safari, Chrome). Everywhere else <SiteMotion />
// adds an IntersectionObserver fade and a scroll listener for the bar, re-arming on
// back-navigation (components/site/SiteMotion.tsx).

// Page copy, plain-language pass (Jesse Dacri's claudespeak note 9/27; Sam
// approved it outright 22:35). Written through sam-voice.
const COPY: Record<string, string> = {
  heroLede:
    "We film your happiest customer at the finished job, saying what they’d tell a neighbor. Then your next customer gets to hear it.",
  watchLede: "So when someone looks you up, a video of one of your jobs should be there to find.",
  so1: "You’ve already got the hard part - a finished job and a customer who’s happy with it.",
  so2: "We sit down with them at the job and ask questions. There’s no script, they just talk. Then we cut what they say together with footage of the work.",
  so3: "Put it on your website and send the link with every estimate. Now people who’ve never met that customer get to hear from them.",
  videoH2: "Hear it from me.",
  workH2: "Here’s some of our work.",
  workLede:
    "The first video is our own clients talking about working with us. Below it are two we made for clients: a fundraising film for Learning Grove and a year-end report for the Boone County Prosecutors’ Office.",
  honest1:
    "Skip the drone shots and the voiceover about your values. People don’t trust a company talking about itself - that’s what the 88% means.",
  honest2:
    "We ask questions and let your customer answer in their own words. If you write it for them, people can tell.",
  honest3:
    "Since October 2024 the FTC bans fake testimonials and paying people for good reviews. That’s good news if your customers already like you!",
  guide2: "It covers everything, from asking your customer to exporting the video for your website.",
}

export default function ServiceBusinessesPage() {
  const t = (k: keyof typeof COPY) => COPY[k]
  const proof: WorkVideo[] = PROOF_SLUGS.map((s) => WORK_VIDEOS.find((v) => v.slug === s)).filter(
    (v): v is WorkVideo => Boolean(v),
  )

  return (
    <SiteFrame
      bare
      footer="silo"
      right={
        // DRAFT MARKER - copy awaiting Sam
        <span className="site-draft-top">
          Draft · 9/24/26<span className="site-wide-only"> · copy awaiting Sam</span>
        </span>
      }
    >
      <div className="site-prog" aria-hidden="true">
        <i id="site-prog" />
      </div>
      <SiteMotion />

      {/* 1 · THE HOOK - opens on real OSC footage: our own clients on camera.
          Muted loop; Safari plays the HLS natively, everywhere else shows the
          poster frame. Starts at the reel's poster moment. */}
      <section id="hook" className="site-hero screen">
        <HeroReel
          poster={thumb(REEL.playbackId, REEL.thumbTime, 1280)}
          hls={`https://stream.mux.com/${REEL.playbackId}.m3u8`}
          startAt={REEL.thumbTime}
        />
        <div className="site-hero-in r">
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            For painters, roofers, remodelers and the trades · Cincinnati
          </div>
          <h1 className="site-big">
            The referral you can <span className="site-accent">replay.</span>
          </h1>
          <p className="site-lede" style={{ marginTop: 22 }}>
            {t("heroLede")}
          </p>
        </div>
      </section>

      {/* 2 · THE MARKET TRUTH */}
      <section id="trust" className="site-screen">
        <div className="site-in r">
          <p className="site-num">
            88%<small className="long">trust a recommendation from someone they know more than anything else</small>
          </p>
          <p className="site-lede" style={{ margin: "26px auto 0" }}>
            Word of mouth beats every ad you could buy.
          </p>
          <span className="site-src">
            Nielsen,{" "}
            <a
              href="https://www.nielsen.com/insights/2021/beyond-martech-building-trust-with-consumers-and-engaging-where-sentiment-is-high/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Trust in Advertising
            </a>
            , 2021. Survey of more than 40,000 people in five regions.
          </span>
        </div>
      </section>

      {/* 3 · THE SHIFT */}
      <section id="shift" className="site-screen white">
        <div className="site-in r">
          <div className="cs-eyebrow" style={{ marginBottom: 22 }}>
            People who trust an online review as much as a friend&rsquo;s recommendation
          </div>
          <div className="site-pair">
            <p className="site-num">
              79%<small>2020</small>
            </p>
            <span className="site-arrow" aria-hidden="true">
              &rarr;
            </span>
            <p className="site-num site-accent">
              42%<small>2025</small>
            </p>
          </div>
          <p className="site-lede" style={{ margin: "26px auto 0" }}>
            Nearly cut in half in five years. People still read reviews - they just don&rsquo;t trust the reviewer like
            they used to.
          </p>
          <span className="site-src">
            BrightLocal,{" "}
            <a
              href="https://www.brightlocal.com/research/local-consumer-review-survey-2025/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Local Consumer Review Survey 2025
            </a>
            . Survey of 1,026 US adults.
          </span>
        </div>
      </section>

      {/* 4 · WHERE THEY WENT */}
      <section id="watch" className="site-screen">
        <div className="site-in r">
          <p className="site-num">
            3<span className="site-accent in-word"> in </span>4
            <small className="long">watch video when they look up a local business</small>
          </p>
          <p className="site-lede" style={{ margin: "26px auto 0" }}>
            {t("watchLede")}
          </p>
          <span className="site-src">Same BrightLocal survey, 2025: 76% of US adults.</span>
        </div>
      </section>

      {/* 5 · WHAT IT MEANS FOR YOU */}
      <section id="so" className="site-screen white">
        <div className="site-in r">
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            So
          </div>
          <h2 className="site-mid">Put your happiest customer on camera.</h2>
          <div className="site-body">
            <p>{t("so1")}</p>
            <p>{t("so2")}</p>
            <p>{t("so3")}</p>
          </div>
          {/* FROM PRICE - Sam 9/24; wording lives in lib/silo-offer.ts */}
          <p className="site-price" aria-label={FROM_PRICE_LINE}>
            Packages from <b>{FROM_PRICE}</b> per video
          </p>
        </div>
      </section>

      {/* 6 · VIDEO - designed around a real 2-minute piece of Sam, not shot yet */}
      <section id="video" className="site-screen ink">
        <div className="site-in r" style={{ maxWidth: 1100 }}>
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            Two minutes from Sam
          </div>
          <h2 className="site-mid">{t("videoH2")}</h2>
          <div className="site-tbd" role="img" aria-label="Video placeholder: Sam on camera, about two minutes, not shot yet">
            <span>Video: Sam on camera, ~2 min stadium pitch - not shot yet</span>
            <PlayBadge />
          </div>
        </div>
      </section>

      {/* 7 · PROOF - real OSC work, the same three Sam chose for Cincinnati Painting Co */}
      <section id="work" className="site-screen">
        <div className="site-in r" style={{ maxWidth: 1100 }}>
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            Work like what you&rsquo;re after
          </div>
          <h2 className="site-mid">{t("workH2")}</h2>
          <p className="site-lede" style={{ margin: "22px auto 0" }}>
            {t("workLede")}
          </p>
          <div className="site-player-wrap">
            <MuxFacade
              src={`https://player.mux.com/${REEL.playbackId}?thumbnail_time=${REEL.thumbTime}&poster=${encodeURIComponent(thumb(REEL.playbackId, REEL.thumbTime, 1280))}`}
              poster={thumb(REEL.playbackId, REEL.thumbTime, 1280)}
              title={REEL.title}
            />
          </div>
          <div className="site-tiles">
            {proof.map((v) => (
              <a key={v.slug} href={`/work/${v.slug}`} className="cs-card cs-pcard">
                <div className="cs-poster">
                  <img src={thumb(v.playbackId, v.thumbTime, 800)} alt="" loading="lazy" />
                  <PlayBadge />
                </div>
                <div className="cs-pcard-body">
                  <h3>{v.title}</h3>
                  <p>{v.client}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · THE HONESTY - Sam's own lines from the 9/6 proposal */}
      <section id="honest" className="site-screen white">
        <div className="site-in r">
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            What we&rsquo;d tell you not to buy
          </div>
          <div className="site-body" style={{ maxWidth: "44ch" }}>
            <p>
              <strong>Not a brand video.</strong> {t("honest1")}
            </p>
            <p>
              <strong>Not a scripted customer.</strong> {t("honest2")}
            </p>
            <p>
              <strong>Not a bought one.</strong> {t("honest3")}
            </p>
          </div>
          <span className="site-src">
            FTC,{" "}
            <a
              href="https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials"
              target="_blank"
              rel="noopener noreferrer"
            >
              Rule on the Use of Consumer Reviews and Testimonials
            </a>
            , 16 CFR Part 465, effective October 21, 2024.
          </span>
        </div>
      </section>

      {/* 9 · THE GIVE - the iPhone guide, offered as a real gift (Sam's words, 9/24).
          The PDF is the clean share copy of the working draft, hosted at
          /guides/iphone-testimonial-guide.pdf. When the Ghost blog post goes
          live, repoint this link there. */}
      <section id="guide" className="site-screen">
        <div className="site-in r">
          <div className="cs-eyebrow" style={{ marginBottom: 18 }}>
            Still thinking you&rsquo;d rather do it yourself?
          </div>
          <h2 className="site-mid">Here&rsquo;s a guide we wrote to help you do that.</h2>
          <div className="site-body">
            <p>The technology is very accessible today. If you have the time and the drive, you can absolutely do this yourself.</p>
            <p>{t("guide2")}</p>
            <p>We&rsquo;re here for the folks who would rather take it off their plate.</p>
          </div>
          <div className="site-act" style={{ justifyContent: "center" }}>
            <a className="cs-btn ghost lg" href="/guides/iphone-testimonial-guide.pdf" target="_blank" rel="noopener">
              Get the iPhone guide (PDF)
            </a>
          </div>
        </div>
      </section>

      {/* 10 · THE INVITATION */}
      <section id="talk" className="site-screen ink short">
        <div className="site-in r">
          <div className="site-rule" />
          <h2 className="site-mid">Got a job you&rsquo;re proud of? Text me.</h2>
          <p className="site-lede" style={{ margin: "22px auto 0" }}>
            I&rsquo;ll read your reviews and tell you which customers belong on camera. No charge, and you can shoot them on
            a phone if you want!
          </p>
          <p className="site-price" aria-label={FROM_PRICE_LINE}>
            Packages from <b>{FROM_PRICE}</b> per video
          </p>
          <div className="site-act" style={{ justifyContent: "center" }}>
            <a className="cs-btn light lg" href="sms:+18595121419">
              (859) 512-1419
            </a>
            <a className="cs-btn on-ink lg" href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
              Book 20 minutes
            </a>
          </div>
          <span className="site-src">
            Sam Patton · <a href="mailto:hello@oliverstreetcreative.com">hello@oliverstreetcreative.com</a> · Covington, KY
          </span>
        </div>
      </section>
    </SiteFrame>
  )
}
