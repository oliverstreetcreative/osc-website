"use client"

import { useState, useEffect, useRef } from "react"

interface TMDBData {
  person: any
  movie_credits: any
  tv_credits: any
}

export default function HomePage() {
  const [videoModalSrc, setVideoModalSrc] = useState<string | null>(null)
  const [tmdbData, setTmdbData] = useState<TMDBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoFadedIn, setLogoFadedIn] = useState(false)
  const [logoFadedOut, setLogoFadedOut] = useState(false)
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

  // Cinematic splash sequence: in-flow curtain that scrolls up to reveal hero
  // Total: ~3.2s (logo fade-in 1.2s + pause 0.6s + logo fade-out 0.6s + beat 0.2s + scroll to hero 0.6s)
  useEffect(() => {
    const timers = splashTimersRef.current

    // Start with page scrolled to top (splash block is first)
    window.scrollTo(0, 0)

    // Step 1: Logo fades in (1.2s transition)
    timers.push(setTimeout(() => setLogoFadedIn(true), 50))

    // Step 2: After logo fade-in (1.2s) + breathing pause (0.6s) = 1.85s, fade logo out
    timers.push(setTimeout(() => setLogoFadedOut(true), 1850))

    // Step 3: After logo fade-out (0.6s) + black beat (0.2s) = 2.65s, scroll to hero
    timers.push(setTimeout(() => {
      dismissSplash()
    }, 2650))

    return () => {
      timers.forEach(clearTimeout)
      splashTimersRef.current = []
    }
  }, [])

  // Scroll-to-hero helper — smoothly scrolls the splash curtain out of view
  const dismissSplash = () => {
    if (splashDismissedRef.current) return
    splashDismissedRef.current = true

    // Clear any pending animation timers
    splashTimersRef.current.forEach(clearTimeout)
    splashTimersRef.current = []

    // Fade the logo out immediately
    setLogoFadedOut(true)

    // Smooth scroll to the hero section
    const scrollToHero = () => {
      if (heroRef.current) {
        heroRef.current.scrollIntoView({ behavior: "smooth" })
      }
      // Mark splash as done after scroll completes
      setTimeout(() => setSplashDone(true), 800)
    }

    // Small delay so logo starts fading before we scroll
    setTimeout(scrollToHero, 250)
  }

  // Scroll-to-skip: any scroll/wheel/touch/key gesture during splash triggers scroll-to-hero
  // Since splash is now in-flow (not fixed), normal scroll events work, but we also
  // listen for wheel/touch/key to trigger the auto-scroll-to-hero dismiss
  useEffect(() => {
    if (splashDone) return

    const onWheel = () => dismissSplash()
    const onTouchMove = () => dismissSplash()
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "Space", "PageDown", "PageUp", "Home", "End", "Escape"].includes(e.code)) {
        dismissSplash()
      }
    }
    const onClick = () => dismissSplash()

    document.addEventListener("wheel", onWheel, { capture: true, passive: true })
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true })
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

  // Hide comparison scroll hint once user scrolls
  useEffect(() => {
    const wrapper = document.querySelector('.comparison-scroll-wrapper') as HTMLElement | null
    if (!wrapper) return
    const onScroll = () => {
      if (wrapper.scrollLeft > 10) {
        wrapper.classList.add('scrolled')
      } else {
        wrapper.classList.remove('scrolled')
      }
    }
    wrapper.addEventListener('scroll', onScroll, { passive: true })
    return () => wrapper.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on anchor click
  const handleNavClick = () => setMobileMenuOpen(false)

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

        {/* Desktop nav links */}
        <div className="nav-links">
          {[
            { href: "#services", label: "What We Do" },
            { href: "#credits", label: "Film Credits" },
            { href: "#testimonials", label: "Testimonials" },
            { href: "#why-us", label: "Why Us" },
            { href: "#portfolio", label: "Portfolio" },
            { href: "#contact", label: "Get Started" },
          ].map((link) => (
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

        {/* Mobile hamburger */}
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
        <a href="#services" onClick={handleNavClick}>What We Do</a>
        <a href="#credits" onClick={handleNavClick}>Film Credits</a>
        <a href="#testimonials" onClick={handleNavClick}>Testimonials</a>
        <a href="#why-us" onClick={handleNavClick}>Why Us</a>
        <a href="#portfolio" onClick={handleNavClick}>Portfolio</a>
        <a href="#contact" onClick={handleNavClick}>Get Started</a>
      </div>

      {/* SPLASH — In-flow curtain block: sits above hero, scrolls up to reveal it */}
      {!splashDone && (
        <div
          style={{
            width: "100%",
            height: "100vh",
            backgroundColor: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
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
        {/* HERO — INK */}
        <section ref={heroRef} id="hero" className="sp-hero" style={{ backgroundColor: "#141412", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#8A8A84" }}>
            Covington, KY
          </div>
          
          <h1 className="mobile-center-block" style={{ fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#F7F6F3", marginBottom: "40px", maxWidth: "900px", margin: "0 auto 40px auto" }}>
            <span className="sr-only">Brand Story Video Production in Cincinnati &amp; Covington, KY — Oliver Street Creative</span>
            <span aria-hidden="true">
              You've got a great story.{" "}
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "#E07830" }}>
                It's just not on camera yet.
              </span>
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
              href="#services"
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
              Learn More
            </a>
          </div>
        </section>

        {/* SERVICES — PURPLE BAND */}
        <section id="services" className="services-section">
          <div className="services-grid">
            <div className="services-text">
              <div className="services-label">WHAT WE DO</div>
              <h2 className="services-heading">Video Production That Gets Results</h2>
              <p className="services-body">
                With our own gear and hands-on management, we are full-service production company from concept to delivery. We bring speed, flexibility, and higher production value—crafting video stories that move both your audience and your bottom line.
              </p>
            </div>
            <img
              src="/images/strategic-videos-hero-new.png"
              alt="Oliver Street Creative videographer filming on location in Cincinnati"
              className="services-image"
              loading="lazy"
            />
          </div>
        </section>

        {/* FILM CREDITS — INK BREATHER */}
        <section id="credits" className="credits-section" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div className="credits-px section-header">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#2E6B9C" }}>
              Film Credits
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px", margin: "0 auto 32px auto" }}>
              Film Industry Experience Behind Every Project
            </h2>

            <div style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1.7, maxWidth: "640px", color: "#8A8A84", marginBottom: "48px", margin: "0 auto 48px auto" }}>
              We've spent years on Hollywood film sets, and that experience shapes every video we make.
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
                        // On mobile, first tap shows overlay; second tap follows link
                        const el = e.currentTarget
                        if (!el.classList.contains("tapped")) {
                          e.preventDefault()
                          // Remove tapped from all siblings
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

        {/* TESTIMONIALS — GOLD BAND */}
        <section id="testimonials" className="sp" style={{ backgroundColor: "#F2C14E", color: "#141412", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", color: "rgba(20,20,18,0.4)" }}>
            Testimonials
          </div>

          <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px" }}>
            Trusted by Nonprofits, Businesses &amp; Government Leaders
          </h2>

          <p style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "800px", margin: "0 auto 64px auto" }}>
            Don't just take our word for it—hear from the founders, nonprofits, and developers we've helped tell their stories.
          </p>

          <div
            style={{ maxWidth: "800px", margin: "0 auto 64px auto", aspectRatio: "16/9", position: "relative", overflow: "hidden", cursor: "pointer", backgroundColor: "#000" }}
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
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
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

          <blockquote style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "clamp(22px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.4, maxWidth: "800px", margin: "0 auto 24px auto" }}>
            "The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate."
          </blockquote>

          <div className="attribution-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.5)" }}>
              — Jordan Huizinga, VP of Development
            </span>
            <img
              src="/client-logos/beech-acres-logo.png"
              alt="Beech Acres"
              style={{ height: "28px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
            />
          </div>

          <div style={{ height: "48px" }}></div>

          <div className="grid-2col-quotes" style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street."
              </div>
              <div className="attribution-row" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                  — Al Haehnle, Director, Landslide Films
                </span>
                <img
                  src="/client-logos/landslide-films-logo.png"
                  alt="Landslide Films"
                  style={{ height: "24px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise."
              </div>
              <div className="attribution-row" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                  — Louis Kelly, Boone County Prosecutor
                </span>
                <img
                  src="/client-logos/boone-county-logo-white-text.png"
                  alt="Boone County"
                  style={{ height: "24px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON CHART — INK BREATHER */}
        <section id="why-us" className="sp" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#E07830" }}>
              Why Us
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "16px" }}>
              Why Choose Oliver Street Creative?
            </h2>

            <p style={{ fontSize: "18px", lineHeight: 1.7, color: "#8A8A84" }}>
              We check every box.
            </p>
          </div>

          {/* Comparison Table */}
          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
            <div style={{ position: "relative" }}>
              <div className="comparison-scroll-wrapper" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "16px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8A8A84", borderBottom: "2px solid #2a2a28", width: "220px" }}></th>
                      {["Oliver Street", "DIY", "Freelancer", "In-House", "Agency"].map((col, i) => (
                        <th
                          key={col}
                          style={{
                            padding: "16px 14px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            textAlign: "center",
                            color: i === 0 ? "#E07830" : "#8A8A84",
                            borderBottom: i === 0 ? "2px solid #E07830" : "2px solid #2a2a28",
                            backgroundColor: i === 0 ? "rgba(224,120,48,0.08)" : "transparent",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Cinematic quality", checks: [true, false, false, false, true] },
                      { feature: "Knows your brand", checks: [true, true, false, true, true] },
                      { feature: "Always available", checks: [true, true, false, true, false] },
                      { feature: "Competitive pricing", checks: [true, true, true, false, false] },
                      { feature: "Full-service (concept to delivery)", checks: [true, false, false, true, true] },
                      { feature: "Strategic storytelling", checks: [true, false, false, false, true] },
                      { feature: "Work with the filmmaker directly", checks: [true, false, true, true, false] },
                      { feature: "Consistent quality", checks: [true, false, false, true, true] },
                      { feature: "Scales with your needs", checks: [true, false, false, false, true] },
                      { feature: "No long-term contract", checks: [true, true, true, false, false] },
                    ].map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        <td style={{
                          padding: "14px 14px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#F7F6F3",
                          textAlign: "left",
                          borderBottom: "1px solid #1e1e1c",
                        }}>
                          {row.feature}
                        </td>
                        {row.checks.map((checked, colIdx) => (
                          <td
                            key={colIdx}
                            style={{
                              padding: "14px 14px",
                              textAlign: "center",
                              borderBottom: "1px solid #1e1e1c",
                              backgroundColor: colIdx === 0 ? "rgba(224,120,48,0.05)" : "transparent",
                            }}
                          >
                            {checked ? (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block" }}>
                                <circle cx="10" cy="10" r="8" fill="#E07830" />
                                <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: "inline-block" }}>
                                <line x1="6" y1="10" x2="14" y2="10" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile scroll hint — gradient fade + swipe text */}
              <div className="comparison-scroll-hint" style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "48px",
                background: "linear-gradient(to right, transparent, #141412)",
                pointerEvents: "none",
                display: "none",
              }} />
              <div className="comparison-swipe-hint" style={{
                display: "none",
                justifyContent: "center",
                alignItems: "center",
                gap: "6px",
                marginTop: "12px",
                fontSize: "12px",
                color: "#8A8A84",
                opacity: 0.7,
              }}>
                <span>Swipe to compare</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "inline-block" }}>
                  <path d="M3 8h10M10 5l3 3-3 3" stroke="#8A8A84" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <style>{`
                @media (max-width: 768px) {
                  .comparison-scroll-hint { display: block !important; transition: opacity 0.3s ease; }
                  .comparison-swipe-hint { display: flex !important; transition: opacity 0.3s ease; }
                  .comparison-scroll-wrapper.scrolled + .comparison-scroll-hint { opacity: 0; pointer-events: none; }
                  .comparison-scroll-wrapper.scrolled ~ .comparison-swipe-hint { opacity: 0; }
                }
              `}</style>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <p style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontStyle: "italic",
              fontSize: "24px",
              fontWeight: 400,
              lineHeight: 1.4,
              color: "#8A8A84",
            }}>
              Agency polish. In-house trust. Freelancer pricing.
            </p>
          </div>
        </section>

        {/* PORTFOLIO — GREEN BAND */}
        <section id="portfolio" className="sp" style={{ backgroundColor: "#3A8A5C", color: "white" }}>
          <div className="section-header">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", color: "rgba(255,255,255,0.5)" }}>
              Portfolio
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px", margin: "0 auto 32px auto" }}>
              Our Video Production Portfolio
            </h2>

            <div style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "640px", color: "rgba(255,255,255,0.75)", marginBottom: "64px", margin: "0 auto 64px auto" }}>
              Here are a few of the stories we've had the privilege to tell.
            </div>
          </div>

          <div className="grid-3col" style={{ gap: "24px" }}>
            {[
              {
                title: "Phoenix's Story",
                alt: "Phoenix's Story — Learning Grove nonprofit fundraising video by Oliver Street Creative",
                client: "Learning Grove, Gala Event 2025",
                embedSrc: "https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM?thumbnail_time=147&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D147&poster=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D147",
                thumbnail: "https://image.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM/thumbnail.webp?width=1920&time=147",
                clientLogo: "/client-logos/learning-grove-logo.png",
                clientName: "Learning Grove",
              },
              {
                title: "2025 End-of-Year Report",
                alt: "2025 End-of-Year Report — Boone County government video production by Oliver Street Creative",
                client: "Boone County Prosecutors' Office",
                embedSrc: "https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8?thumbnail_time=104&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D104&poster=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D104",
                thumbnail: "https://image.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8/thumbnail.webp?width=1920&time=104",
                clientLogo: "/client-logos/boone-county-logo-white-text.png",
                clientName: "Boone County Prosecutors' Office",
                isLightLogo: true,
              },
              {
                title: "Janell's Story",
                alt: "Janell's Story — Beech Acres nonprofit brand storytelling video by Oliver Street Creative",
                client: "Beech Acres, Love Grows Here Event 2024",
                embedSrc: "https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?accent-color=%23E07830&thumbnail_time=238&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FcmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D238&poster=https%3A%2F%2Fimage.mux.com%2FcmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D238",
                thumbnail: "https://image.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co/thumbnail.webp?width=1920&time=238",
                clientLogo: "/client-logos/beech-acres-logo.png",
                clientName: "Beech Acres",
              },
            ].map((item, idx) => (
              <div key={idx} style={{ backgroundColor: "rgba(0,0,0,0.2)", overflow: "hidden", cursor: "pointer" }} onClick={() => setVideoModalSrc(item.embedSrc)}>
                <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                  <img
                    src={item.thumbnail}
                    alt={item.alt || item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                    loading="lazy"
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "16px",
                      right: "16px",
                      top: "auto",
                      left: "auto",
                      transform: "none",
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
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
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
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT — RED BAND */}
        <section id="contact" className="sp" style={{ backgroundColor: "#D13B2E", color: "white", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", color: "rgba(255,255,255,0.5)" }}>
            Get Started
          </div>

          <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "64px" }}>
            Start Your Video Project Today
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
                Book a free consultation call to discuss your video production needs. We'll help you create content that moves hearts, builds trust, and closes deals.
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
          <div>Covington, KY</div>
        </footer>
      </main>
    </div>
  )
}
