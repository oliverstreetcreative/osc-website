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
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const filmCreditsRef = useRef<HTMLDivElement>(null)

  // Rotate BTS photos in Why Us section
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

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

  // Auto-scroll animation for film credits
  useEffect(() => {
    if (filmCreditsRef.current && tmdbData) {
      const container = filmCreditsRef.current
      let isHovered = false
      let isTouching = false

      const handleMouseEnter = () => { isHovered = true }
      const handleMouseLeave = () => { isHovered = false }
      const handleTouchStart = () => { isTouching = true }
      const handleTouchEnd = () => { setTimeout(() => { isTouching = false }, 1000) }

      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
      container.addEventListener("touchstart", handleTouchStart, { passive: true })
      container.addEventListener("touchend", handleTouchEnd, { passive: true })

      const interval = setInterval(() => {
        if (!isHovered && !isTouching && container) {
          const maxScroll = container.scrollWidth - container.clientWidth
          if (container.scrollLeft >= maxScroll) {
            container.scrollLeft = 0
          } else {
            container.scrollLeft += 2
          }
        }
      }, 32)

      return () => {
        clearInterval(interval)
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
        container.removeEventListener("touchstart", handleTouchStart)
        container.removeEventListener("touchend", handleTouchEnd)
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
            { href: "#services", label: "Work" },
            { href: "#credits", label: "Credits" },
            { href: "#portfolio", label: "Portfolio" },
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
        <a href="#services" onClick={handleNavClick}>Work</a>
        <a href="#credits" onClick={handleNavClick}>Credits</a>
        <a href="#portfolio" onClick={handleNavClick}>Portfolio</a>
        <a href="#contact" onClick={handleNavClick}>Contact</a>
      </div>

      <main>
        {/* HERO — INK */}
        <section id="hero" className="sp-hero" style={{ backgroundColor: "#141412" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#8A8A84" }}>
            Covington, KY
          </div>
          
          <h1 style={{ fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#F7F6F3", marginBottom: "40px", maxWidth: "900px" }}>
            Stories that move hearts, build trust, and{" "}
            <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "#E07830" }}>
              close deals.
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
              style={{ scrollBehavior: "smooth" }}
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
                    <div key={`${credit.type}-${credit.id}`} className="flex-shrink-0 group relative">
                      <div style={{ width: "140px", aspectRatio: "2/3", overflow: "hidden", backgroundColor: "#262622", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                        {credit.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${credit.poster_path}`}
                            alt={credit.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-4">
                            <span style={{ fontSize: "12px", textAlign: "center", fontWeight: 500, color: "#8A8A84" }}>{credit.title}</span>
                          </div>
                        )}

                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-4 text-center" style={{ backgroundColor: "rgba(20, 20, 18, 0.95)" }}>
                          <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px", color: "#F7F6F3" }}>{credit.title}</h3>
                          {credit.year && <p style={{ fontSize: "12px", marginBottom: "8px", color: "#8A8A84" }}>({credit.year})</p>}
                          <div style={{ fontSize: "12px", fontWeight: 500, color: "#E07830" }}>
                            {credit.sortedJobs.filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
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

          <div style={{ maxWidth: "800px", margin: "0 auto 64px auto", aspectRatio: "16/9", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", backgroundColor: "#000" }}>
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

          <div style={{ fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(20,20,18,0.5)" }}>
            — Jordan Huizinga, VP of Development, Beech Acres
          </div>

          <div style={{ width: "60px", height: "1px", backgroundColor: "rgba(20,20,18,0.2)", margin: "48px auto" }}></div>

          <div className="grid-2col-quotes" style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street."
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                — Al Haehnle, Director, Landslide Films
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: "italic", fontSize: "20px", lineHeight: 1.5, marginBottom: "12px" }}>
                "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise."
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(20,20,18,0.5)" }}>
                — Louis Kelly, Boone County Prosecutor
              </div>
            </div>
          </div>
        </section>

        {/* WHY US — INK BREATHER */}
        <section className="sp" style={{ backgroundColor: "#141412", color: "#F7F6F3" }}>
          <div className="grid-2col-img">
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "24px", opacity: 0.7, color: "#E07830" }}>
                Why Us
              </div>

              <h2 style={{ fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "32px", maxWidth: "900px" }}>
                We are different than other companies.
              </h2>

              <div style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1.7, maxWidth: "640px", color: "#8A8A84" }}>
                We are a partner, not just a vendor.
              </div>
            </div>

            <div className="img-responsive" style={{ position: "relative", overflow: "hidden" }}>
              {["/IMG_5148.png", "/IMG_5111.jpeg", "/IMG_5114.jpeg"].map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`Behind the scenes ${index + 1}`}
                  style={{
                    position: index === 0 ? "relative" : "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: index === currentImageIndex ? 1 : 0,
                    transition: "opacity 1s ease-in-out",
                  }}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              ))}
            </div>
          </div>

          <div className="grid-3col" style={{ marginTop: "64px" }}>
            {[
              {
                number: "01",
                title: "We know what we're doing.",
                description: "We love telling stories with cameras. We obsess over the big picture and the smallest details. We strive to make each story we tell not just memorable, but unforgettable.",
              },
              {
                number: "02",
                title: "We tell the truth.",
                description: "Most video companies churn out inauthentic ads and sterile corporate content. We create stories that build trust. For developers, nonprofits, and founders, truth—not hype—closes deals.",
              },
              {
                number: "03",
                title: "We win when you win.",
                description: "Owning our gear and managing every step gives us flexibility others can't match. We capture more, revise as needed, and pivot fast when plans change. We can even defer part of our compensation and tie it to your success—so when you win, we win together.",
              },
            ].map((item, idx) => (
              <div key={idx} style={{ padding: "32px", backgroundColor: "#1A1A18" }}>
                <div style={{ fontSize: "64px", fontWeight: 900, color: "rgba(247, 246, 243, 0.08)", lineHeight: 1, marginBottom: "12px" }}>
                  {item.number}
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "12px", color: "#F7F6F3" }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#8A8A84" }}>
                  {item.description}
                </p>
              </div>
            ))}
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
                title: "Janell's Story",
                client: "Beech Acres, Love Grows Here Event 2024",
                embedSrc: "https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?accent-color=%23E07830",
                thumbnail: "https://image.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co/thumbnail.jpg?time=10",
              },
              {
                title: "Phoenix's Story",
                client: "Learning Grove, Gala Event 2025",
                embedSrc: "https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM",
                thumbnail: "https://image.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM/thumbnail.jpg?time=10",
              },
              {
                title: "2025 End-of-Year Report",
                client: "Boone County Prosecutors' Office",
                embedSrc: "https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8",
                thumbnail: "https://image.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8/thumbnail.jpg?time=11",
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
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
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
