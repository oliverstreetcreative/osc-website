import type { Metadata } from "next"
import Link from "next/link"
import { WORK_VIDEOS, muxEmbedSrc, type WorkVideo } from "@/lib/work-videos"

// ---------------------------------------------------------------------------
// /service-businesses - the first silo page, and the template for the rest.
//
// Unlisted: not in the nav, not linked from the homepage, no sibling-silo
// links. Links out only to home, work and contact. A scroll pitch in the
// Holmes stadium beats (Sales/packets/service-business-testimonial-pitch-
// packet.md): the market truth for this buyer, what it means for them, proof
// from real OSC work, then the invitation. One idea per screen.
//
// This is the first page built to Sam's visual reference (Apple's product
// pages): big type, one idea per screen, video-led, phone-first. It ships no
// client JavaScript. Reveal motion is CSS scroll-driven animation with a
// static fallback, so it costs nothing on a phone.
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
    "Customer testimonial films for painters, roofers, remodelers and the trades in Cincinnati and Northern Kentucky. A real customer, on camera, in the finished space.",
  alternates: { canonical: "https://oliverstreetcreative.com/service-businesses" },
  openGraph: {
    title: "The referral you can replay",
    description:
      "A real customer, on camera, in the finished space. Word of mouth your next customer can watch.",
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

const CSS = `
  .sb { background:#141412; color:#F7F6F3; font-family: var(--font-inter), Inter, -apple-system, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .sb a { color: inherit; }
  .sb-top { position: sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between; padding: 14px 20px; background: rgba(20,20,18,.82); backdrop-filter: saturate(160%) blur(14px); -webkit-backdrop-filter: saturate(160%) blur(14px); }
  .sb-top img { height: 34px; width:auto; display:block; }
  .sb-draft { font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; color: rgba(247,246,243,.85); border: 1px dashed rgba(247,246,243,.55); padding: 5px 9px; }
  .s { min-height: min(100svh, 1000px); display:grid; place-items:center; padding: clamp(72px, 12vh, 150px) 20px; text-align:center; }
  .s.alt { background:#000; }
  .hero { position: relative; overflow: hidden; }
  .hero-v { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .hero-shade { position:absolute; inset:0; background: linear-gradient(180deg, rgba(20,20,18,.55) 0%, rgba(20,20,18,.72) 55%, #141412 100%); }
  .s.short { min-height: min(70svh, 760px); }
  .in { max-width: 880px; margin: 0 auto; }
  .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(247,246,243,.5); margin-bottom: 22px; }
  .big { font-size: clamp(40px, 8.6vw, 116px); font-weight: 800; line-height: .98; letter-spacing: -.035em; margin: 0; text-wrap: balance; }
  .mid { font-size: clamp(30px, 5.4vw, 68px); font-weight: 800; line-height: 1.02; letter-spacing: -.03em; margin: 0; text-wrap: balance; }
  .lede { font-size: clamp(19px, 2.2vw, 27px); line-height: 1.35; color: rgba(247,246,243,.72); max-width: 36ch; margin: 26px auto 0; text-wrap: pretty; }
  .body { font-size: clamp(18px, 1.9vw, 22px); line-height: 1.45; color: rgba(247,246,243,.78); max-width: 40ch; margin: 22px auto 0; text-align:left; text-wrap: pretty; }
  .body p { margin: 0 0 18px; }
  .num { font-size: clamp(110px, 26vw, 300px); font-weight: 900; line-height: .88; letter-spacing: -.06em; margin: 0; }
  .num small { display:block; font-size: clamp(16px, 2vw, 22px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(247,246,243,.5); margin-top: clamp(18px, 3.2vw, 44px); }
  .pair { display:flex; gap: clamp(12px, 4vw, 56px); align-items: flex-end; justify-content:center; flex-wrap: nowrap; }
  .pair .num { font-size: clamp(64px, 17vw, 190px); }
  .arrow { font-size: clamp(40px, 6vw, 80px); color:#E07830; align-self:center; line-height:1; }
  .accent { color:#E07830; }
  .src { display:block; margin-top: 30px; font-size: 13px; color: rgba(247,246,243,.42); }
  .src a { text-decoration: underline; text-underline-offset: 3px; }
  .frame { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 16/9; margin: 34px auto 0; border: 2px dashed rgba(247,246,243,.5); display:grid; place-items:center; background: #000; }
  .frame .play { width: 76px; height: 76px; border-radius: 50%; background: rgba(247,246,243,.92); display:grid; place-items:center; }
  .frame .play i { display:block; width:0; height:0; border-top: 14px solid transparent; border-bottom: 14px solid transparent; border-left: 22px solid #141412; margin-left: 5px; }
  .frame .label { position:absolute; left: 14px; right: 14px; top: 12px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(247,246,243,.85); text-align:left; }
  .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 1200px; margin: 36px auto 0; text-align:left; }
  .tile { display:block; background: rgba(255,255,255,.05); text-decoration:none; }
  .tile img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; }
  .tile .t { padding: 14px 16px 16px; }
  .tile .t b { display:block; font-size: 17px; font-weight: 800; }
  .tile .t span { display:block; font-size: 13px; color: rgba(247,246,243,.6); margin-top: 3px; }
  .player { width:100%; max-width: 1100px; aspect-ratio: 16/9; margin: 30px auto 0; background:#000; border:0; display:block; }
  .rule { width: 48px; height: 3px; background:#E07830; margin: 0 auto 28px; }
  .cta { display:inline-block; margin-top: 30px; padding: 18px 34px; background:#E07830; color:#141412; font-weight: 800; letter-spacing:.06em; text-transform: uppercase; font-size: 14px; text-decoration:none; }
  .cta.ghost { background: transparent; color:#F7F6F3; border: 2px solid rgba(247,246,243,.5); margin-left: 10px; }
  .foot { padding: 40px 20px 60px; text-align:center; font-size: 13px; color: rgba(247,246,243,.45); border-top: 1px solid rgba(255,255,255,.1); }
  .foot a { margin: 0 10px; text-decoration:none; color: rgba(247,246,243,.7); }
  .num small.long { text-transform:none; letter-spacing:0; font-weight:600; font-size: clamp(19px, 2.3vw, 28px); line-height:1.3; color: rgba(247,246,243,.88); max-width: 24ch; margin-left:auto; margin-right:auto; }
  .in-word { font-size: .32em; font-weight: 800; letter-spacing: 0; vertical-align: .9em; margin: 0 .12em; }
  /* ---- MOTION VARIANT (?feel=on) - Sam is trying it on his phone; default stays calm ---- */
  .sb-top-r { display:flex; align-items:center; }
  .sb-feel { margin-left: 10px; font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; color: rgba(247,246,243,.7); text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; line-height: 1; }
  .feel-on { display:none; }
  html[data-feel="on"] .feel-on { display:inline; }
  html[data-feel="on"] .feel-off { display:none; }
  .prog { display:none; }
  html[data-feel="on"] .prog { display:block; position: fixed; right: 5px; top: 84px; bottom: 28px; width: 3px; border-radius: 3px; background: rgba(247,246,243,.14); z-index: 6; pointer-events:none; }
  html[data-feel="on"] .prog i { display:block; width:100%; height:100%; border-radius: 3px; background:#E07830; transform-origin: top; transform: scaleY(var(--p, 0)); }
  @supports (animation-timeline: scroll()) {
    html[data-feel="on"] .prog i { animation: sb-prog linear both; animation-timeline: scroll(root); }
  }
  @keyframes sb-prog { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  html[data-feel="on"] .r { animation: none; }
  html[data-feel="on"] .r > * { opacity: 0; transform: translateY(36px); transition: opacity .55s ease-out, transform .55s ease-out; }
  html[data-feel="on"] .r > .seen { opacity: 1; transform: none; }
  @supports (animation-timeline: view()) {
    html[data-feel="on"] .r > * { opacity: 1; transform: none; transition: none; animation: sb-settle linear both; animation-timeline: view(); animation-range: entry 0% cover 42%; }
  }
  @keyframes sb-settle { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    html[data-feel="on"] .r > * { animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important; }
  }
  .r { opacity: 1; }
  @supports (animation-timeline: view()) {
    .r { animation: sb-rise linear both; animation-timeline: view(); animation-range: entry 0% entry 35%; }
  }
  @keyframes sb-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .r { animation: none !important; } }
  @media (max-width: 720px) {
    .s { padding: clamp(64px, 10vh, 110px) 18px; }
    .grid { grid-template-columns: 1fr; }
    .cta, .cta.ghost { display:block; margin: 14px 0 0; text-align:center; }
    .pair { gap: 10px; }
    .pair .num { font-size: 16.5vw; }
    .arrow { font-size: 32px; }
    .sb-top { padding: 12px 16px; }
    .wide-only { display: none; }
  }
`

// Motion variant switch. ?feel=on turns on the per-block settle-in and the
// right-edge progress bar. CSS does the work where scroll-driven animations
// exist; this only adds fallbacks (IntersectionObserver fade, scroll listener
// for the bar) where they don't. Nothing runs when the variant is off.
const FEEL_JS = `(function(){try{
var on=new URLSearchParams(location.search).get('feel')==='on';
if(!on)return;
document.documentElement.setAttribute('data-feel','on');
var S=window.CSS&&CSS.supports;
if(!(S&&CSS.supports('animation-timeline: view()'))&&'IntersectionObserver' in window){
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target);}});},{rootMargin:'0px 0px -12% 0px'});
 var go=function(){document.querySelectorAll('.r > *').forEach(function(el){io.observe(el);});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}
if(!(S&&CSS.supports('animation-timeline: scroll()'))){
 var upd=function(){var b=document.getElementById('sb-prog');if(!b)return;var h=document.documentElement;var m=h.scrollHeight-h.clientHeight;b.style.setProperty('--p',m>0?(h.scrollTop/m).toFixed(4):'0');};
 addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);document.addEventListener('DOMContentLoaded',upd);upd();
}
}catch(e){}})();`

export default function ServiceBusinessesPage() {
  const proof: WorkVideo[] = PROOF_SLUGS
    .map((s) => WORK_VIDEOS.find((v) => v.slug === s))
    .filter((v): v is WorkVideo => Boolean(v))

  return (
    <div className="sb">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="sb-top">
        <Link href="/" aria-label="Oliver Street Creative home">
          <img src="/logo.png" alt="Oliver Street Creative" />
        </Link>
        {/* DRAFT MARKER - copy awaiting Sam */}
        <span className="sb-top-r">
          <span className="sb-draft">Draft · 9/24/26<span className="wide-only"> · copy awaiting Sam</span></span>
          {/* STAGING TRY-OUT: flips the motion variant. Remove once Sam picks. */}
          <a className="sb-feel feel-off" href="?feel=on">Motion: off</a>
          <a className="sb-feel feel-on" href="/service-businesses">Motion: on</a>
        </span>
      </header>
      <div className="prog" aria-hidden="true"><i id="sb-prog" /></div>
      <script dangerouslySetInnerHTML={{ __html: FEEL_JS }} />

      <main>
        {/* 1 · THE HOOK - opens on real OSC footage: our own clients on camera.
            Muted HLS loop; iOS Safari plays it natively (no player JS), other
            browsers show the poster frame. Starts at the reel's poster moment. */}
        <section id="hook" className="s hero">
          <video
            className="hero-v"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={thumb(REEL.playbackId, REEL.thumbTime, 1280)}
            src={`https://stream.mux.com/${REEL.playbackId}.m3u8#t=${REEL.thumbTime}`}
            aria-hidden="true"
          />
          <div className="hero-shade" aria-hidden="true" />
          <div className="in r" style={{ position: "relative" }}>
            <div className="eyebrow">For painters, roofers, remodelers and the trades · Cincinnati</div>
            <h1 className="big">The referral you can <span className="accent">replay.</span></h1>
            <p className="lede">A real customer, on camera, in the finished space. That&rsquo;s word of mouth your next customer can watch.</p>
          </div>
        </section>

        {/* 2 · THE MARKET TRUTH */}
        <section id="trust" className="s alt">
          <div className="in r">
            <p className="num">88%<small className="long">trust a recommendation from someone they know more than anything else</small></p>
            <p className="lede">Word of mouth beats every ad you could buy.</p>
            <span className="src">
              Nielsen, <a href="https://www.nielsen.com/insights/2021/beyond-martech-building-trust-with-consumers-and-engaging-where-sentiment-is-high/" target="_blank" rel="noopener noreferrer">Trust in Advertising</a>, 2021. Survey of more than 40,000 people in five regions.
            </span>
          </div>
        </section>

        {/* 3 · THE SHIFT */}
        <section id="shift" className="s">
          <div className="in r">
            <div className="eyebrow">People who trust an online review as much as a friend&rsquo;s recommendation</div>
            <div className="pair">
              <p className="num">79%<small>2020</small></p>
              <span className="arrow" aria-hidden="true">&rarr;</span>
              <p className="num accent">42%<small>2025</small></p>
            </div>
            <p className="lede">Nearly cut in half in five years. People still read reviews - they just don&rsquo;t trust the reviewer like they used to.</p>
            <span className="src">
              BrightLocal, <a href="https://www.brightlocal.com/research/local-consumer-review-survey-2025/" target="_blank" rel="noopener noreferrer">Local Consumer Review Survey 2025</a>. Survey of 1,026 US adults.
            </span>
          </div>
        </section>

        {/* 4 · WHERE THEY WENT */}
        <section id="watch" className="s alt">
          <div className="in r">
            <p className="num">3<span className="accent in-word"> in </span>4<small className="long">watch video when they look up a local business</small></p>
            <p className="lede">So when someone looks you up, there&rsquo;s a good chance they&rsquo;re watching something. The question is whether it&rsquo;s yours.</p>
            <span className="src">Same BrightLocal survey, 2025: 76% of US adults.</span>
          </div>
        </section>

        {/* 5 · WHAT IT MEANS FOR YOU */}
        <section id="so" className="s">
          <div className="in r">
            <div className="eyebrow">So</div>
            <h2 className="mid">Put your happiest customer on camera.</h2>
            <div className="body">
              <p>The job&rsquo;s done. They love it. The before and after already exists.</p>
              <p>We sit down with them in the finished space and let them say what they&rsquo;d tell a neighbor. No script - we ask, they answer. Then we cut it against the work.</p>
              <p>That&rsquo;s the referral, captured once, watched by people they&rsquo;ll never meet. On your website, and in the follow-up after every estimate.</p>
            </div>
          </div>
        </section>

        {/* 6 · VIDEO - designed around a real 2-minute piece of Sam, not shot yet */}
        <section id="video" className="s alt">
          <div className="in r" style={{ maxWidth: "1100px" }}>
            <div className="eyebrow">Two minutes from Sam</div>
            <h2 className="mid">Why this works, from the guy who&rsquo;ll be holding the camera.</h2>
            <div className="frame" role="img" aria-label="Video placeholder: Sam on camera, about two minutes, not shot yet">
              <span className="label">VIDEO: Sam on camera, ~2 min stadium pitch - not shot yet</span>
              <div className="play"><i /></div>
            </div>
          </div>
        </section>

        {/* 7 · PROOF - real OSC work, the same three Sam chose for Cincinnati Painting Co */}
        <section id="work" className="s">
          <div className="in r" style={{ maxWidth: "1200px" }}>
            <div className="eyebrow">Work like what you&rsquo;re after</div>
            <h2 className="mid">Our clients, on camera, on what it was like.</h2>
            <p className="lede">A story told by one person, a year told by an office, and our own clients on working with us.</p>
            <iframe
              className="player"
              src={`https://player.mux.com/${REEL.playbackId}?thumbnail_time=${REEL.thumbTime}&poster=${encodeURIComponent(thumb(REEL.playbackId, REEL.thumbTime, 1280))}`}
              title={REEL.title}
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "1100px" }}>
              {proof.map((v) => (
                <Link key={v.slug} href={`/work/${v.slug}`} className="tile">
                  <img src={thumb(v.playbackId, v.thumbTime, 800)} alt={`${v.title} - ${v.clientName}`} loading="lazy" />
                  <div className="t">
                    <b>{v.title}</b>
                    <span>{v.client}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · THE HONESTY - Sam's own lines from the 9/6 proposal */}
        <section id="honest" className="s alt">
          <div className="in r">
            <div className="eyebrow">What we&rsquo;d tell you not to buy</div>
            <div className="body" style={{ maxWidth: "44ch" }}>
              <p><strong>Not a brand video.</strong> Drone shots and a voiceover about your values. Nobody trusts a company describing itself. That&rsquo;s what the 88% is telling you.</p>
              <p><strong>Not a scripted customer.</strong> We ask questions. They answer. If it&rsquo;s written for them, it&rsquo;s an ad, and people can tell.</p>
              <p><strong>Not a bought one.</strong> Since October 2024 the FTC bans fake testimonials and paying people for good reviews. Good news if your customers already like you.</p>
            </div>
            <span className="src">
              FTC, <a href="https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials" target="_blank" rel="noopener noreferrer">Rule on the Use of Consumer Reviews and Testimonials</a>, 16 CFR Part 465, effective October 21, 2024.
            </span>
          </div>
        </section>

        {/* 9 · THE GIVE - the iPhone guide slot (blog, not published yet) */}
        <section id="guide" className="s">
          <div className="in r">
            <div className="eyebrow">Want to try it on your phone first?</div>
            <h2 className="mid">Good. Here&rsquo;s how.</h2>
            <div className="body">
              <p>We&rsquo;re putting together a guide to getting a testimonial that actually works on an iPhone. Where to stand, what to ask. When to stop talking.</p>
              <p>Shoot the job progress yourself. Let us do the one where your customer&rsquo;s face is the product.</p>
            </div>
            {/* LINK PLACEHOLDER - the guide will live on blog.oliverstreetcreative.com; swap the href when it's published */}
            <a className="cta ghost" href="https://blog.oliverstreetcreative.com/" style={{ marginLeft: 0 }}>The iPhone guide - coming soon</a>
          </div>
        </section>

        {/* 10 · THE INVITATION */}
        <section id="talk" className="s alt short">
          <div className="in r">
            <div className="rule" />
            <h2 className="mid">Got a job you&rsquo;re proud of? Text me.</h2>
            <p className="lede">I&rsquo;ll read your reviews and tell you which customers belong on camera. No charge, and you can shoot them on a phone if you want!</p>
            <div>
              <a className="cta" href="sms:+18595121419">(859) 512-1419</a>
              <a className="cta ghost" href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">Book 20 minutes</a>
            </div>
            <span className="src">Sam Patton · <a href="mailto:hello@oliverstreetcreative.com">hello@oliverstreetcreative.com</a> · Covington, KY</span>
          </div>
        </section>
      </main>

      <footer className="foot">
        <Link href="/">Home</Link>
        <Link href="/#work">Work</Link>
        <Link href="/#contact">Contact</Link>
        <div style={{ marginTop: "14px" }}>© {new Date().getFullYear()} Oliver Street Creative · Stories that move hearts, open minds, and build trust.</div>
      </footer>
    </div>
  )
}
