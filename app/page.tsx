"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { WORK_VIDEOS, muxEmbedSrc, muxThumbnail, type WorkVideo } from "@/lib/work-videos"

// ---------------------------------------------------------------------------
// CONTENT-AND-STRUCTURE PASS (staging, 2026-09-23).
// The visual system (Kodak palette, Inter 900 headings, EB Garamond italic
// accents, band sections, nav/splash) is unchanged on purpose — Sam has not
// given a visual direction yet. What changed is the MESSAGE:
//   tagline  — "Stories that build trust, move hearts, and close deals."
//   thesis   — sam-voice draft v2 (osc-thesis-v2-2026-09-23), marked DRAFT
//   pillars  — BUILD TRUST / MOVE HEARTS / CLOSE DEALS, each backed only by
//              work that is already public on /work/ or quotes already on
//              the site. Nothing invented.
// Every AI-generated image of Sam is gone; a labelled placeholder holds the
// slot until a real photo exists.
// ---------------------------------------------------------------------------

interface TMDBData {
  person: any
  movie_credits: any
  tv_credits: any
}

type PillarKey = "build-trust" | "move-hearts" | "close-deals"

interface Pillar {
  key: PillarKey
  label: string
  color: string
  what: string
  body: string
  /** slugs from WORK_VIDEOS — public /work/ pages only */
  workSlugs: string[]
  quote?: { text: string; name: string; title: string }
  note?: string
}

// The three clauses of the tagline, mapped to what OSC actually does and to
// work that is already public. The quotes are the same three that were on the
// old homepage — no new client words.
const PILLARS: Pillar[] = [
  {
    key: "build-trust",
    label: "Build trust",
    color: "#2E6B9C",
    what: "Testimonials and brand films",
    body:
      "A real customer or a real founder saying what they actually think, shot so the person comes through and not the pitch.",
    workSlugs: ["boone-county-2025"],
    quote: {
      text: "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise.",
      name: "Louis Kelly",
      title: "Boone County Prosecutor",
    },
  },
  {
    key: "move-hearts",
    label: "Move hearts",
    color: "#D13B2E",
    what: "Fundraising and nonprofit story films",
    body:
      "The film that plays at the gala or the breakfast, in the room where people decide whether to give.",
    workSlugs: ["phoenixs-story", "janells-story"],
    quote: {
      text: "The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate.",
      name: "Jordan Huizinga",
      title: "VP of Development, Beech Acres",
    },
  },
  {
    key: "close-deals",
    label: "Close deals",
    color: "#F2C14E",
    what: "Sales and campaign work",
    body:
      "Video made to move one specific person to one specific decision.",
    workSlugs: [],
    quote: {
      text: "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street.",
      name: "Al Haehnle",
      title: "Director, Landslide Films",
    },
    note: "Sample sales and campaign work available by request.",
  },
]

const PILLAR_BY_SLUG: Record<string, Pillar> = Object.fromEntries(
  PILLARS.flatMap((p) => p.workSlugs.map((s) => [s, p])),
)

const EYEBROW: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  marginBottom: "24px",
}

const SERIF_ITALIC: React.CSSProperties = {
  fontFamily: "'EB Garamond', Georgia, serif",
  fontStyle: "italic",
  fontWeight: 400,
}

const NAV_LINKS = [
  { href: "#why-trust", label: "Why Trust" },
  { href: "#what-we-do", label: "What We Do" },
  { href: "#work", label: "Work" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#credits", label: "Film Credits" },
  { href: "#contact", label: "Get Started" },
]

export default function HomePage() {
  const [videoModalSrc, setVideoModalSrc] = useState<string | null>(null)
  const [tmdbData, setTmdbData] = useState<TMDBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoFadedIn, setLogoFadedIn] = useState(false)
  const [logoFadedOut, setLogoFadedOut] = useState(false)
  const [splashFading, setSplashFading] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const splashTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const splashDismissedRef = useRef(false)
  const heroRef = useRef<HTMLElement>(null)
  const filmCreditsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchTMDBData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/tmdb")
        const data = await response.json()
        setTmdbData(data)
      } catch (error) {
        console.error("Failed to fetch TMDB data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTMDBData()
  }, [])

  // Cinematic splash sequence: fixed overlay curtain over the page content
  // Total: ~3.45s (logo fade-in 1.2s + pause 0.6s + logo fade-out 0.6s + beat 0.25s + overlay fade 0.8s)
  useEffect(() => {
    const timers = splashTimersRef.current

    document.body.style.overflow = "hidden"

    timers.push(setTimeout(() => setLogoFadedIn(true), 50))
    timers.push(setTimeout(() => setLogoFadedOut(true), 1850))
    timers.push(setTimeout(() => {
      dismissSplash()
    }, 2650))

    return () => {
      timers.forEach(clearTimeout)
      splashTimersRef.current = []
      document.body.style.overflow = ""
    }
  }, [])

  const dismissSplash = () => {
    if (splashDismissedRef.current) return
    splashDismissedRef.current = true

    splashTimersRef.current.forEach(clearTimeout)
    splashTimersRef.current = []

    setLogoFadedOut(true)
    setSplashFading(true)

    setTimeout(() => {
      setSplashDone(true)
      document.body.style.overflow = ""
    }, 800)
  }

  // Scroll-to-skip: wheel/touch/key/click during splash triggers fade-out
  useEffect(() => {
    if (splashDone) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dismissSplash()
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      dismissSplash()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "Space", "PageDown", "PageUp", "Home", "End", "Escape"].includes(e.code)) {
        e.preventDefault()
        dismissSplash()
      }
    }
    const onClick = () => dismissSplash()

    document.addEventListener("wheel", onWheel, { capture: true, passive: false })
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false })
    document.addEventListener("keydown", onKeyDown, { capture: true })
    document.addEventListener("click", onClick, { capture: true })
    document.addEventListener("pointerdown", onClick, { capture: true })

    return () => {
      document.removeEventListener("wheel", onWheel, { capture: true })
      document.removeEventListener("touchmove", onTouchMove, { capture: true })
      document.removeEventListener("keydown", onKeyDown, { capture: true })
      document.removeEventListener("click", onClick, { capture: true })
      document.removeEventListener("pointerdown", onClick, { capture: true })
    }
  }, [splashDone])

  // Auto-scroll animation for film credits
  useEffect(() => {
    if (filmCreditsRef.current && tmdbData) {
      const container = filmCreditsRef.current
      let paused = false
      let resumeTimer: ReturnType<typeof setTimeout> | null = null

      const pause = () => {
        paused = true
        if (resumeTimer) clearTimeout(resumeTimer)
      }
      const scheduleResume = (delay: number) => {
        if (resumeTimer) clearTimeout(resumeTimer)
        resumeTimer = setTimeout(() => { paused = false }, delay)
      }

      const onMouseEnter = () => pause()
      const onMouseLeave = () => scheduleResume(500)
      const onTouchStart = () => pause()
      const onTouchEnd = () => scheduleResume(3000)

      container.addEventListener("mouseenter", onMouseEnter)
      container.addEventListener("mouseleave", onMouseLeave)
      container.addEventListener("touchstart", onTouchStart, { passive: true })
      container.addEventListener("touchend", onTouchEnd, { passive: true })

      let animId: number
      const step = () => {
        if (!paused && container) {
          const maxScroll = container.scrollWidth - container.clientWidth
          if (container.scrollLeft >= maxScroll) {
            container.scrollLeft = 0
          } else {
            container.scrollLeft += 1
          }
        }
        animId = requestAnimationFrame(step)
      }
      animId = requestAnimationFrame(step)

      return () => {
        cancelAnimationFrame(animId)
        if (resumeTimer) clearTimeout(resumeTimer)
        container.removeEventListener("mouseenter", onMouseEnter)
        container.removeEventListener("mouseleave", onMouseLeave)
        container.removeEventListener("touchstart", onTouchStart)
        container.removeEventListener("touchend", onTouchEnd)
      }
    }
  }, [tmdbData])

  const handleNavClick = () => setMobileMenuOpen(false)
  const openVideo = (v: WorkVideo) => setVideoModalSrc(muxEmbedSrc(v))

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
      {/* Video Modal */}
      {videoModalSrc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setVideoModalSrc(null)}
        >
          <div
            style={{ width: "100%", maxWidth: "1200px", aspectRatio: "16/9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={videoModalSrc}
              className="w-full h-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          </div>
          <button
            onClick={() => setVideoModalSrc(null)}
            aria-label="Close video"
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              color: "white",
              fontSize: "40px",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation — hidden during splash */}
      <nav className="nav-bar" style={{ opacity: splashDone ? 1 : 0, transition: "opacity 0.4s ease-in-out" }}>
        <div style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "0.05em", textTransform: "uppercase", color: "#F7F6F3" }}>
          Oliver Street <span style={{ color: "#E07830" }}>Creative</span>
        </div>

        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{ color: "#8A8A84", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", marginLeft: "32px", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F7F6F3")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8A8A84")}
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={handleNavClick}>{link.label}</a>
        ))}
      </div>

      {/* SPLASH — Fixed overlay curtain */}
      {!splashDone && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: splashFading ? 0 : 1,
            transition: "opacity 0.8s ease-in-out",
            pointerEvents: splashFading ? "none" : "auto",
          }}
        >
          <img
            src="/logo.png"
            alt="Oliver Street Creative — brand story video production in Cincinnati and Northern Kentucky"
            style={{
              width: "70%",
              maxWidth: "400px",
              height: "auto",
              opacity: logoFadedOut ? 0 : logoFadedIn ? 1 : 0,
              transform: logoFadedIn ? "translateY(0)" : "translateY(25px)",
              transition: logoFadedOut
                ? "opacity 0.6s ease-in-out"
                : "opacity 1.2s ease-in-out, transform 1.2s ease-in-out",
            }}
            draggable={false}
          />
        </div>
      )}

      <main>
        {/* HERO — INK. The tagline IS the headline. */}
        <section ref={heroRef} id="hero" className="sp-hero" style={{ backgroundColor: "#141412", textAlign: "center" }}>
          <div style={{ ...EYEBROW, opacity: 0.7, color: "#8A8A84" }}>
            Covington, KY
          </div>

          <h1 className="mobile-center-block" style={{ fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#F7F6F3", maxWidth: "980px", margin: "0 auto 40px auto" }}>
            <span className="sr-only">Oliver Street Creative — stories that build trust, move hearts, and close deals. Video production in Cincinnati &amp; Covington, KY.</span>
            <span aria-hidden="true">
              Stories that build trust, move hearts, and{" "}
              <span style={{ ...SERIF_ITALIC, color: "#E07830" }}>close deals.</span>
            </span>
          </h1>

          <div className="hero-buttons" style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href="https://cal.com/oliverstreetcreative"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "16px 40px", backgroundColor: "#E07830", color: "#141412", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none", transition: "background 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c86820")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E07830")}
            >
              Book A Call
            </a>
            <a
              href="#work"
              style={{ padding: "14px 40px", border: "2px solid #E07830", color: "#E07830", backgroundColor: "transparent", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#E07830"
                e.currentTarget.style.color = "#141412"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "#E07830"
              }}
            >
              See The Work
            </a>
          </div>
        </section>

        {/* THESIS — PURPLE BAND (was "What we do"). Text + image-slot layout kept. */}
        <section id="why-trust" className="services-section">
          <div className="services-grid">
            <div className="services-text">
              <div className="services-label">WHY TRUST</div>
              <h2 className="services-heading">Your brand doesn&rsquo;t need content. It needs trust.</h2>

              {/* DRAFT MARKER — thesis copy is sam-voice draft v2 (2026-09-23), not yet approved by Sam */}
              <div
                style={{
                  display: "inline-block",
                  margin: "0 0 20px 0",
                  padding: "4px 10px",
                  border: "1px dashed rgba(255,255,255,0.6)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                Draft copy · v2 · 9/23/26 · awaiting Sam
              </div>

              <p className="services-body" style={{ marginBottom: "16px" }}>
                Screens aren&rsquo;t going anywhere. More and more of how we meet people, hire people, give to causes, and decide who to trust happens through a screen. And now anyone can make &ldquo;content.&rdquo; AI can make it by the truckload, for free.
              </p>
              <p className="services-body" style={{ marginBottom: "16px" }}>
                But content isn&rsquo;t what moves people. Trust is. People have to believe you.
              </p>
              <p className="services-body" style={{ marginBottom: "16px" }}>
                That happens when a real person comes through the screen &mdash; a customer, a founder, a family your work helped. Getting that to come through takes craft. Knowing what to ask, when to stop talking, how to light a face so it looks like a person and not an ad, and how to cut it so it still sounds like them.
              </p>
              <p className="services-body" style={{ marginBottom: "16px" }}>
                It&rsquo;s not flashy. It&rsquo;s good, honest work. That&rsquo;s what we do.
              </p>
            </div>

            {/* REAL PHOTO NEEDED — this slot held /images/strategic-videos-hero-new.png, an AI-generated image of Sam. Removed per the no-AI-imagery rule. */}
            <div
              className="services-image"
              role="img"
              aria-label="Placeholder: real photograph of Sam Patton needed"
              style={{
                aspectRatio: "4 / 3",
                border: "2px dashed rgba(255,255,255,0.55)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "24px",
                gap: "10px",
                color: "rgba(255,255,255,0.85)",
                backgroundColor: "rgba(0,0,0,0.15)",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Real photo needed
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.5, maxWidth: "320px", opacity: 0.8 }}>
                Sam on set, behind the camera or with a client. A real photograph &mdash; no AI imagery. The previous image here was AI-generated and has been removed.
              </div>
            </div>
          </div>
        </section>

        {/* THREE PILLARS — INK. The tagline's three clauses, each backed by public work. */}
        <section id="what-we-do" className="sp" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div className="section-header">
            <div style={{ ...EYEBROW, opacity: 0.7, color: "#E07830" }}>
              What We Do
            </div>
            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, maxWidth: "900px", margin: "0 auto 32px auto" }}>
              Three jobs a story can do.
            </h2>
            <div style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "640px", color: "#8A8A84", margin: "0 auto 64px auto" }}>
              Every film we make is built to do one of them. Here is what that looks like, with the work to prove it.
            </div>
          </div>

          <div className="grid-3col" style={{ gap: "24px", alignItems: "stretch" }}>
            {PILLARS.map((p) => {
              const works = p.workSlugs
                .map((s) => WORK_VIDEOS.find((v) => v.slug === s))
                .filter((v): v is WorkVideo => Boolean(v))
              return (
                <div
                  key={p.key}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderTop: `4px solid ${p.color}`,
                    padding: "32px 28px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: p.color }}>
                    {p.what}
                  </div>
                  <h3 style={{ fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                    {p.label}.
                  </h3>
                  <p style={{ fontSize: "16px", lineHeight: 1.7, color: "#C8C7C2" }}>{p.body}</p>

                  {works.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8A8A84" }}>
                        The work
                      </div>
                      {works.map((v) => (
                        <button
                          key={v.slug}
                          type="button"
                          onClick={() => openVideo(v)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            background: "none",
                            border: "1px solid rgba(255,255,255,0.12)",
                            padding: "10px 12px",
                            cursor: "pointer",
                            color: "#F7F6F3",
                            textAlign: "left",
                          }}
                        >
                          <img
                            src={muxThumbnail(v)}
                            alt=""
                            loading="lazy"
                            style={{ width: "72px", aspectRatio: "16/9", objectFit: "cover", flexShrink: 0 }}
                          />
                          <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 800 }}>{v.title}</span>
                            <span style={{ fontSize: "12px", color: "#8A8A84" }}>{v.client}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {p.note && (
                    <p style={{ fontSize: "13px", color: "#8A8A84", marginTop: "4px" }}>
                      <a href="#contact" style={{ color: "#F7F6F3", textDecoration: "underline", textUnderlineOffset: "4px" }}>
                        {p.note}
                      </a>
                    </p>
                  )}

                  {p.quote && (
                    <blockquote style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ ...SERIF_ITALIC, fontSize: "17px", lineHeight: 1.55, color: "#F7F6F3", marginBottom: "12px" }}>
                        &ldquo;{p.quote.text}&rdquo;
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A8A84" }}>
                          &mdash; {p.quote.name}
                        </span>
                        <span style={{ fontSize: "12px", color: "#8A8A84" }}>{p.quote.title}</span>
                      </div>
                    </blockquote>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* WORK — BLACK BAND. The public three, each tagged with the job it does. */}
        <section id="work" className="sp" style={{ backgroundColor: "#000000", color: "white" }}>
          <div className="section-header">
            <div style={{ ...EYEBROW, color: "rgba(255,255,255,0.5)" }}>
              Work
            </div>
            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, maxWidth: "900px", margin: "0 auto 32px auto" }}>
              See it for yourself.
            </h2>
            <div style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "640px", color: "rgba(255,255,255,0.75)", margin: "0 auto 64px auto" }}>
              Here are a few of the stories we&rsquo;ve had the privilege to tell.
            </div>
          </div>

          <div className="grid-3col" style={{ gap: "24px" }}>
            {WORK_VIDEOS.map((item) => {
              const pillar = PILLAR_BY_SLUG[item.slug]
              return (
                <div key={item.slug} style={{ backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden", cursor: "pointer" }} onClick={() => openVideo(item)}>
                  <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                    <img
                      src={muxThumbnail(item)}
                      alt={`${item.title} — ${item.clientName} video by Oliver Street Creative`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                      loading="lazy"
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    />
                    {pillar && (
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "12px",
                          padding: "4px 10px",
                          backgroundColor: pillar.color,
                          color: pillar.key === "close-deals" ? "#141412" : "#F7F6F3",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}
                      >
                        {pillar.label}
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.8,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderTop: "10px solid transparent",
                          borderBottom: "10px solid transparent",
                          borderLeft: "16px solid #141412",
                          marginLeft: "3px",
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ padding: "20px" }}>
                    <div className="video-title-row" style={{ marginBottom: "4px" }}>
                      {item.clientLogo && (
                        <img
                          src={item.clientLogo}
                          alt={item.clientName}
                          className="video-title-logo"
                          style={{ filter: item.isLightLogo ? "none" : "brightness(0) invert(1)" }}
                        />
                      )}
                      <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{item.title}</h3>
                    </div>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{item.client}</p>
                    <p style={{ fontSize: "12px", marginTop: "8px" }}>
                      <a href={`/work/${item.slug}`} onClick={(e) => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline", textUnderlineOffset: "4px" }}>
                        Open in its own page
                      </a>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ textAlign: "center", marginTop: "48px", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
            <a href="#contact" onClick={handleNavClick} style={{ color: "white", textDecoration: "underline", textUnderlineOffset: "4px" }}>
              More sample work available by request
            </a>.
          </p>
        </section>

        {/* TESTIMONIALS — GOLD BAND (unchanged: same three real quotes, same film) */}
        <section id="testimonials" className="sp testimonials-section" style={{ backgroundColor: "#F2C14E", color: "#141412", textAlign: "center" }}>
          <div style={{ ...EYEBROW, color: "rgba(20,20,18,0.4)" }}>
            Testimonials
          </div>

          <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "20px" }}>
            People like working with us.
          </h2>

          <p style={{ fontSize: "17px", lineHeight: 1.7, maxWidth: "560px", margin: "0 auto 56px auto", color: "rgba(20,20,18,0.65)" }}>
            Don&rsquo;t just take our word for it&mdash;hear from the founders, nonprofits, and developers we&rsquo;ve helped tell their stories.
          </p>

          <div className="testimonial-featured" style={{ maxWidth: "1100px", margin: "0 auto 56px auto" }}>
            <div
              className="testimonial-video"
              style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden", cursor: "pointer", backgroundColor: "#000", borderRadius: "8px" }}
              onClick={() => setVideoModalSrc("https://player.mux.com/4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28?accent-color=%23E07830&start=93")}
              onMouseEnter={(e) => {
                const img = e.currentTarget.querySelector("img") as HTMLImageElement
                const btn = e.currentTarget.querySelector(".testimonial-play-btn") as HTMLElement
                if (img) img.style.transform = "scale(1.03)"
                if (btn) btn.style.opacity = "1"
              }}
              onMouseLeave={(e) => {
                const img = e.currentTarget.querySelector("img") as HTMLImageElement
                const btn = e.currentTarget.querySelector(".testimonial-play-btn") as HTMLElement
                if (img) img.style.transform = "scale(1)"
                if (btn) btn.style.opacity = "0.8"
              }}
            >
              <img
                src="https://image.mux.com/4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28/thumbnail.webp?width=1920&time=93"
                alt="Client testimonial video — nonprofits and businesses share their experience with Oliver Street Creative"
                style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", borderRadius: "8px" }}
                loading="lazy"
              />
              <div
                className="testimonial-play-btn"
                style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "16px",
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.8,
                  transition: "opacity 0.2s",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "10px solid transparent",
                    borderBottom: "10px solid transparent",
                    borderLeft: "16px solid #141412",
                    marginLeft: "3px",
                  }}
                />
              </div>
            </div>

            <div className="testimonial-featured-quote" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left" }}>
              <blockquote style={{ ...SERIF_ITALIC, fontSize: "clamp(20px, 2.5vw, 30px)", lineHeight: 1.5, marginBottom: "20px", color: "#141412" }}>
                &ldquo;The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate.&rdquo;
              </blockquote>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.55)" }}>
                  &mdash; Jordan Huizinga
                </span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(20,20,18,0.4)" }}>
                  VP of Development
                </span>
                <img
                  src="/client-logos/beech-acres-logo.png"
                  alt="Beech Acres"
                  style={{ height: "26px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.5 }}
                />
              </div>
            </div>
          </div>

          <div className="testimonial-cards" style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div className="testimonial-card" style={{ backgroundColor: "rgba(20,20,18,0.06)", borderRadius: "12px", padding: "32px 28px", textAlign: "left" }}>
              <div style={{ ...SERIF_ITALIC, fontSize: "19px", lineHeight: 1.6, marginBottom: "20px", color: "#141412" }}>
                &ldquo;It comes down to content, creativity, creative editing, and storytelling. That&rsquo;s what separates the crowd from working with Oliver Street.&rdquo;
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.55)" }}>
                  &mdash; Al Haehnle
                </span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(20,20,18,0.4)" }}>
                  Director, Landslide Films
                </span>
                <img
                  src="/client-logos/landslide-films-logo.png"
                  alt="Landslide Films"
                  style={{ height: "22px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.5 }}
                />
              </div>
            </div>

            <div className="testimonial-card" style={{ backgroundColor: "rgba(20,20,18,0.06)", borderRadius: "12px", padding: "32px 28px", textAlign: "left" }}>
              <div style={{ ...SERIF_ITALIC, fontSize: "19px", lineHeight: 1.6, marginBottom: "20px", color: "#141412" }}>
                &ldquo;Oliver Street brought a level of depth and soul to our production that we wouldn&rsquo;t have had otherwise.&rdquo;
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.55)" }}>
                  &mdash; Louis Kelly
                </span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(20,20,18,0.4)" }}>
                  Boone County Prosecutor
                </span>
                <img
                  src="/client-logos/boone-county-logo-white-text.png"
                  alt="Boone County"
                  style={{ height: "22px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.5 }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* FILM CREDITS — INK. The craft has a paper trail. */}
        <section id="credits" className="credits-section" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div className="credits-px section-header">
            <div style={{ ...EYEBROW, opacity: 0.7, color: "#2E6B9C" }}>
              Film Credits
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, maxWidth: "900px", margin: "0 auto 32px auto" }}>
              The craft comes from the movies.
            </h2>

            <div style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1.7, maxWidth: "640px", color: "#8A8A84", margin: "0 auto 48px auto" }}>
              We&rsquo;ve spent years on Hollywood film sets, and that experience shapes every video we make.
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "64px 0" }}>
              <div
                className="inline-block animate-spin rounded-full h-12 w-12 border-b-2"
                style={{ borderBottomColor: "#E07830" }}
              ></div>
            </div>
          ) : tmdbData ? (
            <div
              ref={filmCreditsRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide credits-px"
              style={{ touchAction: "pan-x", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}
            >
              {(() => {
                const jobImportance: Record<string, number> = {
                  Director: 1,
                  Producer: 2,
                  "Executive Producer": 2,
                  "Co-Producer": 2,
                  "Associate Producer": 2,
                  "Unit Production Manager": 3,
                  "Production Supervisor": 4,
                  "Production Accountant": 5,
                  "Production Coordinator": 8,
                  "Production Assistant": 12,
                }

                const getJobPriority = (job: string) => {
                  if (jobImportance[job]) return jobImportance[job]
                  if (job.toLowerCase().includes("director")) return 1
                  if (job.toLowerCase().includes("producer")) return 2
                  return 13
                }

                const allCredits = new Map()

                tmdbData.movie_credits?.crew?.forEach((movie: any) => {
                  const key = `movie-${movie.id}`
                  if (allCredits.has(key)) {
                    const existing = allCredits.get(key)
                    existing.jobs = [...new Set([...existing.jobs, movie.job])]
                  } else {
                    allCredits.set(key, {
                      ...movie,
                      type: "movie",
                      jobs: [movie.job],
                      year: movie.release_date?.split("-")[0],
                    })
                  }
                })

                tmdbData.tv_credits?.crew?.forEach((show: any) => {
                  const key = `tv-${show.id}`
                  if (allCredits.has(key)) {
                    const existing = allCredits.get(key)
                    existing.jobs = [...new Set([...existing.jobs, show.job])]
                  } else {
                    allCredits.set(key, {
                      ...show,
                      type: "tv",
                      title: show.name,
                      jobs: [show.job],
                      year: show.first_air_date?.split("-")[0],
                    })
                  }
                })

                return Array.from(allCredits.values())
                  .map((credit: any) => ({
                    ...credit,
                    sortedJobs: credit.jobs.sort((a: string, b: string) => getJobPriority(a) - getJobPriority(b)),
                    topJobPriority: Math.min(...credit.jobs.map(getJobPriority)),
                    releaseDate: credit.type === "movie" ? credit.release_date : credit.first_air_date,
                  }))
                  .sort((a: any, b: any) => {
                    if (a.topJobPriority !== b.topJobPriority) {
                      return a.topJobPriority - b.topJobPriority
                    }
                    if (a.releaseDate && b.releaseDate) {
                      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
                    }
                    return 0
                  })
                  .map((credit: any) => (
                    <a
                      key={`${credit.type}-${credit.id}`}
                      href={`https://www.themoviedb.org/${credit.type}/${credit.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 group relative poster-card"
                      style={{ textDecoration: "none" }}
                      onClick={(e) => {
                        const el = e.currentTarget
                        if (!el.classList.contains("tapped")) {
                          e.preventDefault()
                          el.parentElement?.querySelectorAll(".tapped").forEach((s) => s.classList.remove("tapped"))
                          el.classList.add("tapped")
                        }
                      }}
                    >
                      <div style={{ width: "140px", aspectRatio: "2/3", overflow: "hidden", backgroundColor: "#262622", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                        {credit.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${credit.poster_path}`}
                            alt={credit.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-4">
                            <span style={{ fontSize: "12px", textAlign: "center", fontWeight: 500, color: "#8A8A84" }}>{credit.title}</span>
                          </div>
                        )}

                        <div className="poster-overlay absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-4 text-center" style={{ backgroundColor: "rgba(20, 20, 18, 0.95)" }}>
                          <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#F7F6F3" }}>{credit.title}</h3>
                          {credit.year && <p style={{ fontSize: "12px", marginBottom: "8px", color: "#8A8A84" }}>({credit.year})</p>}
                          <div style={{ fontSize: "12px", fontWeight: 500, color: "#E07830" }}>
                            {credit.sortedJobs.filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))
              })()}
            </div>
          ) : null}
        </section>

        {/* CONTACT — RED BAND */}
        <section id="contact" className="sp" style={{ backgroundColor: "#D13B2E", color: "white", textAlign: "center" }}>
          <div style={{ ...EYEBROW, color: "rgba(255,255,255,0.5)" }}>
            Get Started
          </div>

          <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "64px" }}>
            Let&rsquo;s make something together.
          </h2>

          <div className="grid-2col" style={{ maxWidth: "900px", margin: "0 auto", textAlign: "left" }}>
            <div style={{ padding: "32px", backgroundColor: "rgba(0,0,0,0.2)" }}>
              <h3 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Get In Touch</h3>
              <p style={{ lineHeight: 1.8 }}>
                <strong>Email</strong><br />
                <a href="mailto:hello@oliverstreetcreative.com" style={{ color: "white", textDecoration: "underline", textUnderlineOffset: "4px" }}>
                  hello@oliverstreetcreative.com
                </a><br /><br />
                <strong>Phone</strong><br />
                <a href="tel:+18595121419" style={{ color: "white", textDecoration: "none" }}>
                  (859) 512-1419
                </a><br /><br />
                <strong>Studio</strong><br />
                521 Oliver St<br />
                Covington, KY 41014
              </p>
            </div>

            <div style={{ padding: "32px", backgroundColor: "rgba(0,0,0,0.2)" }}>
              <h3 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Ready to Start?</h3>
              <p style={{ lineHeight: 1.8, marginBottom: "24px" }}>
                Book a free call. Tell us who needs to trust you, and we&rsquo;ll talk about the story that gets you there.
              </p>
              <a
                href="https://cal.com/oliverstreetcreative"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", width: "100%", textAlign: "center", padding: "16px 40px", backgroundColor: "white", color: "#D13B2E", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Schedule Free Consultation
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer-bar">
          <div>© 2026 Oliver Street Creative</div>
          <div>Stories that build trust, move hearts, and close deals.</div>
          <div>Covington, KY</div>
        </footer>
      </main>
    </div>
  )
}
