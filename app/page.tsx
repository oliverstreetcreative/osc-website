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
  const [splashOpacity, setSplashOpacity] = useState(1)
  const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(false)
  const [scrollIndicatorFaded, setScrollIndicatorFaded] = useState(false)
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

  // Splash logo fade on scroll
  useEffect(() => {
    const onScroll = () => {
      const progress = Math.min(window.scrollY / (window.innerHeight * 0.6), 1)
      setSplashOpacity(1 - progress)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll indicator: fade in after delay, fade out on scroll
  useEffect(() => {
    const fadeInTimer = setTimeout(() => setScrollIndicatorVisible(true), 1500)
    return () => clearTimeout(fadeInTimer)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 80) {
        setScrollIndicatorFaded(true)
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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

      {/* Navigation */}
      <nav className="nav-bar">
        <div style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "0.05em", textTransform: "uppercase", color: "#F7F6F3" }}>
          Oliver Street <span style={{ color: "#E07830" }}>Creative</span>
        </div>

        {/* Desktop nav links */}
        <div className="nav-links">
          {[
            { href: "#services", label: "Services" },
            { href: "#portfolio", label: "Work" },
            { href: "#about", label: "About" },
            { href: "#contact", label: "Contact" },
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
        <a href="#services" onClick={handleNavClick}>Services</a>
        <a href="#portfolio" onClick={handleNavClick}>Work</a>
        <a href="#about" onClick={handleNavClick}>About</a>
        <a href="#contact" onClick={handleNavClick}>Contact</a>
      </div>

      {/* SPLASH — Full-screen logo, fades on scroll */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 110,
          backgroundColor: "#141412",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: splashOpacity,
          pointerEvents: splashOpacity < 0.05 ? "none" : "auto",
        }}
      >
        <img
          src="/logo.png"
          alt="Oliver Street Creative"
          style={{ width: "70%", maxWidth: "400px", height: "auto" }}
          draggable={false}
        />

        {/* Scroll indicator chevron */}
        <button
          onClick={() => {
            const hero = document.getElementById("hero")
            if (hero) hero.scrollIntoView({ behavior: "smooth" })
          }}
          aria-label="Scroll down"
          className="scroll-indicator"
          style={{
            position: "absolute",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            opacity: scrollIndicatorVisible && !scrollIndicatorFaded ? 0.6 : 0,
            transition: "opacity 0.6s ease",
            pointerEvents: scrollIndicatorVisible && !scrollIndicatorFaded ? "auto" : "none",
            animation: scrollIndicatorVisible && !scrollIndicatorFaded ? "scrollBounce 2.4s ease-in-out infinite" : "none",
          }}
        >
          <svg width="24" height="14" viewBox="0 0 24 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2L12 12L22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Spacer so hero starts below the splash viewport */}
      <div style={{ height: "100vh" }} />

      <main>
        {/* HERO — INK */}
        <section id="hero" className="sp-hero" style={{ backgroundColor: "#141412" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#8A8A84" }}>
            Covington, KY
          </div>
          
          <h1 style={{ fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#F7F6F3", marginBottom: "40px", maxWidth: "900px" }}>
            You've got a great story.{" "}
            <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "#E07830" }}>
              It's just not on camera yet.
            </span>
          </h1>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
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
        <section id="services" className="sp" style={{ backgroundColor: "#7B4D9E", color: "white" }}>
          <div className="grid-2col-img">
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "rgba(255,255,255,0.5)" }}>
                What We Do
              </div>

              <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px" }}>
                We make strategic videos for businesses and non-profits
              </h2>

              <div style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1.7, maxWidth: "640px", color: "rgba(255,255,255,0.75)" }}>
                With our own gear and hands-on management, we are full-service from concept to delivery. We bring speed, flexibility, and higher production value—crafting video stories that move both your audience and your bottom line.
              </div>
            </div>

            <img
              src="/images/strategic-videos-hero-new.png"
              alt="Videographer with camera"
              className="img-responsive"
              loading="lazy"
            />
          </div>
        </section>

        {/* FILM CREDITS — INK BREATHER */}
        <section id="credits" className="credits-section" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div className="credits-px">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#2E6B9C" }}>
              Film Credits
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px" }}>
              We've worked on a lot of movies.
            </h2>

            <div style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1.7, maxWidth: "640px", color: "#8A8A84", marginBottom: "48px" }}>
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
        <section className="sp" style={{ backgroundColor: "#F2C14E", color: "#141412", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", color: "rgba(20,20,18,0.4)" }}>
            Testimonials
          </div>

          <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px" }}>
            People like working with us.
          </h2>

          <p style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "800px", margin: "0 auto 64px auto" }}>
            Don't just take our word for it—hear from the founders, nonprofits, and developers we've helped tell their stories.
          </p>

          <div style={{ maxWidth: "800px", margin: "0 auto 64px auto", aspectRatio: "16/9", backgroundColor: "#000" }}>
            <iframe
              src="https://player.mux.com/4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28?accent-color=%23E07830"
              className="w-full h-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title="Client Testimonials"
            />
          </div>

          <blockquote style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "clamp(22px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.4, maxWidth: "800px", margin: "0 auto 24px auto" }}>
            "The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate."
          </blockquote>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.5)" }}>
              — Jordan Huizinga, VP of Development
            </span>
            <img
              src="/client-logos/beech-acres-logo.png"
              alt="Beech Acres"
              style={{ height: "28px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
              loading="lazy"
            />
          </div>

          <div style={{ height: "48px" }}></div>

          <div className="grid-2col-quotes" style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street."
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                  — Al Haehnle, Director, Landslide Films
                </span>
                <img
                  src="/client-logos/landslide-films-logo.png"
                  alt="Landslide Films"
                  style={{ height: "24px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
                  loading="lazy"
                />
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise."
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                  — Louis Kelly, Boone County Prosecutor
                </span>
                <img
                  src="/client-logos/boone-county-logo.png"
                  alt="Boone County"
                  style={{ height: "24px", width: "auto", objectFit: "contain", filter: "brightness(0)", opacity: 0.6 }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON CHART — INK BREATHER */}
        <section id="about" className="sp" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#E07830" }}>
              Why Us
            </div>

            <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "16px" }}>
              You have options.
            </h2>

            <p style={{ fontSize: "18px", lineHeight: 1.7, color: "#8A8A84" }}>
              Only one checks every box.
            </p>
          </div>

          {/* Comparison Table */}
          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "16px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8A8A84", borderBottom: "2px solid #2a2a28", width: "220px" }}></th>
                    {["DIY", "Freelancer", "In-House", "Agency", "Oliver Street"].map((col, i) => (
                      <th
                        key={col}
                        style={{
                          padding: "16px 14px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          textAlign: "center",
                          color: i === 4 ? "#E07830" : "#8A8A84",
                          borderBottom: i === 4 ? "2px solid #E07830" : "2px solid #2a2a28",
                          backgroundColor: i === 4 ? "rgba(224,120,48,0.08)" : "transparent",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Cinematic quality", checks: [false, false, false, true, true] },
                    { feature: "Knows your brand", checks: [true, false, true, false, true] },
                    { feature: "Always available", checks: [true, false, true, true, true] },
                    { feature: "Competitive pricing", checks: [true, true, false, false, true] },
                    { feature: "Full-service (concept to delivery)", checks: [false, false, false, true, true] },
                    { feature: "Strategic storytelling", checks: [false, false, false, true, true] },
                    { feature: "Work with the filmmaker directly", checks: [false, true, true, false, true] },
                    { feature: "Consistent quality", checks: [false, false, false, true, true] },
                    { feature: "Scales with your needs", checks: [false, false, false, true, true] },
                    { feature: "No long-term contract", checks: [true, true, false, false, true] },
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
                            backgroundColor: colIdx === 4 ? "rgba(224,120,48,0.05)" : "transparent",
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
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", color: "rgba(255,255,255,0.5)" }}>
            Portfolio
          </div>

          <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px" }}>
            Check out our work.
          </h2>

          <div style={{ fontSize: "18px", lineHeight: 1.7, maxWidth: "640px", color: "rgba(255,255,255,0.75)", marginBottom: "64px" }}>
            Here are a few of the stories we've had the privilege to tell.
          </div>

          <div className="grid-3col" style={{ gap: "24px" }}>
            {[
              {
                title: "Phoenix's Story",
                client: "Learning Grove, Gala Event 2025",
                embedSrc: "https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM",
                thumbnail: "https://image.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM/thumbnail.webp?width=1920&time=147",
                clientLogo: "/client-logos/learning-grove-logo.png",
                clientName: "Learning Grove",
              },
              {
                title: "2025 End-of-Year Report",
                client: "Boone County Prosecutors' Office",
                embedSrc: "https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8",
                thumbnail: "https://image.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8/thumbnail.webp?width=1920&time=104",
                clientLogo: "/client-logos/boone-county-logo.png",
                clientName: "Boone County Prosecutors' Office",
                isLightLogo: true,
              },
              {
                title: "Janell's Story",
                client: "Beech Acres, Love Grows Here Event 2024",
                embedSrc: "https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?accent-color=%23E07830",
                thumbnail: "https://image.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co/thumbnail.webp?width=1920&time=238",
                clientLogo: "/client-logos/beech-acres-logo.png",
                clientName: "Beech Acres",
              },
            ].map((item, idx) => (
              <div key={idx} style={{ backgroundColor: "rgba(0,0,0,0.2)", overflow: "hidden", cursor: "pointer" }} onClick={() => setVideoModalSrc(item.embedSrc)}>
                <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
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
                  {item.clientLogo && (
                    <div style={{ marginBottom: "12px", opacity: 0.85 }}>
                      <img
                        src={item.clientLogo}
                        alt={item.clientName}
                        style={{ height: "24px", width: "auto", filter: item.isLightLogo ? "none" : "brightness(0) invert(1)", objectFit: "contain" }}
                        loading="lazy"
                      />
                    </div>
                  )}
                  <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "4px" }}>{item.title}</h3>
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
            Let's make something together.
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
