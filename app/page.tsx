"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Menu, X } from "lucide-react"

interface TMDBData {
  person: any
  movie_credits: any
  tv_credits: any
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [tmdbData, setTmdbData] = useState<TMDBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
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

  useEffect(() => {
    if (filmCreditsRef.current) {
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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % 3)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 px-4 py-2 rounded font-medium"
        style={{ backgroundColor: "var(--orange)", color: "var(--paper)" }}
      >
        Skip to main content
      </a>

      {/* Navigation - with film perforation aesthetic */}
      <nav className="fixed top-0 w-full z-40 filmstrip-texture" style={{ backgroundColor: "rgba(20, 20, 18, 0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid #2A2A26" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <a href="#hero" className="text-lg sm:text-xl font-bold uppercase tracking-tight" style={{ color: "var(--paper)" }}>
              Oliver Street Creative
            </a>

            <div className="hidden md:flex items-center space-x-6">
              {[
                { href: "#hero", label: "Home" },
                { href: "#about", label: "About" },
                { href: "#portfolio", label: "Portfolio" },
                { href: "#connect", label: "Contact" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "#9A9A95" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A95")}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="https://portal.oliverstreetcreative.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-colors"
                style={{ color: "#9A9A95" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A95")}
              >
                Client Portal
              </a>
              <Button
                asChild
                className="text-sm font-semibold"
                style={{ backgroundColor: "var(--orange)", color: "var(--paper)", border: "none" }}
              >
                <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                  Book Call
                </a>
              </Button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
              style={{ color: "var(--paper)" }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden" style={{ backgroundColor: "var(--ink)", borderTop: "1px solid #2A2A26" }}>
            <div className="px-4 py-4 space-y-4">
              {[
                { href: "#hero", label: "Home" },
                { href: "#about", label: "About" },
                { href: "#portfolio", label: "Portfolio" },
                { href: "#connect", label: "Contact" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-lg py-2 transition-colors"
                  style={{ color: "#9A9A95" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A95")}
                >
                  {item.label}
                </a>
              ))}
              <Button
                size="lg"
                asChild
                className="w-full text-lg"
                style={{ backgroundColor: "var(--orange)", color: "var(--paper)" }}
              >
                <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                  Schedule Consultation
                </a>
              </Button>
            </div>
          </div>
        )}
      </nav>

      <main id="main-content">
        {/* Hero Section */}
        <section id="hero" className="pt-20 sm:pt-24 min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <div className="text-center">
              <div className="mb-8 sm:mb-12">
                <img
                  src="/logo.png"
                  alt="Oliver Street Creative - Professional Video Production"
                  className="mx-auto h-48 sm:h-64 md:h-80 lg:h-96 w-auto"
                />
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-8 sm:mb-12 leading-tight">
                <span className="block" style={{ color: "var(--paper)" }}>Stories that move hearts,</span>
                <span className="block" style={{ color: "var(--paper)" }}>build trust and</span>
                <span className="block">
                  <span style={{ color: "var(--orange)" }}>close deals</span>
                  <span style={{ color: "var(--paper)" }}>.</span>
                </span>
              </h1>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
                <Button
                  size="lg"
                  asChild
                  className="w-full sm:w-auto text-lg px-8 py-4"
                  style={{ backgroundColor: "var(--orange)", color: "var(--paper)" }}
                >
                  <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                    Book A Call
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full sm:w-auto text-lg px-8 py-4"
                  style={{ borderColor: "var(--orange)", color: "var(--orange)", backgroundColor: "transparent" }}
                >
                  <a href="#about">Learn More</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Strategic Video Section - with purple label */}
        <section className="py-16 sm:py-24 label-border-purple" style={{ backgroundColor: "#1A1A18", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="aspect-[4/3] relative overflow-hidden rounded-lg">
                <img
                  src="/images/strategic-videos-hero-new.png"
                  alt="Professional videographer holding cinema camera"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-center lg:text-left">
                <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--purple)", color: "var(--paper)" }}>
                  What We Do
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight" style={{ color: "var(--paper)" }}>
                  We make strategic videos for businesses and non-profits
                </h2>
                <p className="text-lg sm:text-xl mb-8 leading-relaxed" style={{ color: "#9A9A95" }}>
                  With our own gear and hands-on management, we are full-service from concept to delivery. We bring
                  speed, flexibility, and higher production value—crafting video stories that move both your audience
                  and your bottom line.
                </p>

                <div className="flex justify-start w-full">
                  <img
                    src="/images/strategic-video-icons.png"
                    alt="Production process icons"
                    className="w-full max-w-md h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Film Credits Section - with blue label */}
        <section className="py-12 sm:py-16 label-border-blue overflow-hidden" style={{ backgroundColor: "var(--ink)", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--blue)", color: "var(--paper)" }}>
                Experience
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "var(--paper)" }}>
                We've worked on a lot of movies.
              </h2>
              <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: "#9A9A95" }}>
                We've spent years on Hollywood film sets, and that experience shapes every video we make.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div
                  className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
                  style={{ borderBottomColor: "var(--orange)" }}
                ></div>
                <p className="mt-4" style={{ color: "#9A9A95" }}>Loading filmography...</p>
              </div>
            ) : tmdbData ? (
              <div className="relative">
                <div
                  ref={filmCreditsRef}
                  className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    touchAction: "pan-x",
                  }}
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
                          <div className="w-32 sm:w-40 aspect-[2/3] rounded-lg overflow-hidden shadow-lg relative" style={{ backgroundColor: "#262622" }}>
                            {credit.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w300${credit.poster_path}`}
                                alt={credit.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-center px-2" style={{ color: "#9A9A95" }}>{credit.title}</span>
                              </div>
                            )}

                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-3 text-center" style={{ backgroundColor: "rgba(20, 20, 18, 0.95)" }}>
                              <h3 className="font-bold text-sm mb-1 uppercase" style={{ color: "var(--paper)" }}>{credit.title}</h3>
                              {credit.year && <p className="text-xs mb-2" style={{ color: "#9A9A95" }}>({credit.year})</p>}
                              <div className="text-xs" style={{ color: "var(--orange)" }}>
                                {credit.sortedJobs.filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p style={{ color: "#9A9A95" }}>Unable to load filmography at this time.</p>
              </div>
            )}
          </div>
        </section>

        {/* Testimonials Section - with gold label for accent quotes */}
        <section id="about" className="py-16 sm:py-24 label-border-gold" style={{ backgroundColor: "#1A1A18", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--gold)", color: "var(--ink)" }}>
                Testimonials
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "var(--paper)" }}>
                People like working with us.
              </h2>
              <p className="text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "#9A9A95" }}>
                Don't just take our word for it—hear from the founders, nonprofits, and developers we've helped tell
                their stories.
              </p>
            </div>

            <div className="max-w-4xl mx-auto mb-12 sm:mb-16">
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: "#262622" }}>
                <iframe
                  src="https://player.mux.com/4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28?accent-color=%23E07830"
                  style={{ width: "100%", height: "100%", border: "none", aspectRatio: "16/9" }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  title="Client Testimonial Video"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 sm:mb-16">
              {[
                {
                  quote: "The partnership with Oliver Street Creative was so valuable in understanding our goals and our values and the mission and impact that we wanted to communicate.",
                  name: "Jordan Huizinga",
                  title: "VP of Development, Beech Acres",
                },
                {
                  quote: "It comes down to content, creativity, creative editing, and storytelling. That's what separates the crowd from working with Oliver Street.",
                  name: "Al Haehnle",
                  title: "Director, Landslide Films",
                },
                {
                  quote: "Oliver Street brought a level of depth and soul to our production that we wouldn't have had otherwise.",
                  name: "Louis Kelly",
                  title: "Boone County Prosecutor",
                },
              ].map((testimonial, idx) => (
                <Card key={idx} className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#262622", borderTop: "3px solid var(--gold)" }}>
                  <div className="mb-4">
                    <p className="font-accent text-xl leading-relaxed" style={{ color: "var(--gold)" }}>
                      "{testimonial.quote}"
                    </p>
                  </div>
                  <div className="border-t pt-4" style={{ borderColor: "#3A3A36" }}>
                    <p className="font-semibold" style={{ color: "var(--paper)" }}>{testimonial.name}</p>
                    <p className="text-sm" style={{ color: "#9A9A95" }}>{testimonial.title}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Differentiators Section - with orange label */}
        <section className="py-16 sm:py-24 label-border-orange" style={{ backgroundColor: "var(--ink)", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--orange)", color: "var(--paper)" }}>
                Why Us
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "var(--paper)" }}>
                We are different than other companies.
              </h2>
              <p className="text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "#9A9A95" }}>
                We are a partner, not just a vendor.
              </p>
            </div>

            <div className="mb-12 sm:mb-16">
              <div className="max-w-4xl mx-auto">
                <div className="aspect-[3/2] relative overflow-hidden rounded-lg">
                  {["/IMG_5148.png", "/IMG_5111.jpeg", "/IMG_5114.jpeg"].map((src, index) => (
                    <img
                      key={index}
                      src={src}
                      alt={`Professional video production behind the scenes ${index + 1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                        index === currentImageIndex ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
              {[
                {
                  icon: "/filmstrip.png",
                  title: "We know what we're doing.",
                  description: "We love telling stories with cameras. We obsess over the big picture and the smallest details. We strive to make each story we tell not just memorable, but unforgettable.",
                },
                {
                  icon: "/shield.png",
                  title: "We tell the truth.",
                  description: "Most video companies churn out inauthentic ads and sterile corporate content. We create stories that build trust. For developers, nonprofits, and founders, truth—not hype—closes deals.",
                },
                {
                  icon: "/trophy.png",
                  title: "We win when you win.",
                  description: "Owning our gear and managing every step gives us flexibility others can't match. We capture more, revise as needed, and pivot fast when plans change. We can even defer part of our compensation and tie it to your success—so when you win, we win together.",
                },
              ].map((item, idx) => (
                <Card key={idx} className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#262622" }}>
                  <div className="mb-6">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: "#3A3A36" }}
                    >
                      <img src={item.icon} alt="" className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: "var(--paper)" }}>
                      {item.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: "#9A9A95" }}>
                      {item.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Portfolio Section - with green label */}
        <section id="portfolio" className="py-16 sm:py-24 label-border-green" style={{ backgroundColor: "#1A1A18", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--green)", color: "var(--paper)" }}>
                Portfolio
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "var(--paper)" }}>
                Check out our work.
              </h2>
              <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: "#9A9A95" }}>
                Here are a few of the stories we've had the privilege to tell.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
              {[
                {
                  title: "Janell's Story",
                  client: "Client: Beech Acres, Love Grows Here Event 2024",
                  embedSrc: "https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?metadata-video-title=Janell%27s+Story&video-title=Janell%27s+Story&accent-color=%23E07830",
                },
                {
                  title: "Phoenix's Story",
                  client: "Client: Learning Grove, Gala Event 2025",
                  embedSrc: "https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM?poster=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.png%3Fwidth%3D1280%26height%3D720%26time%3D147",
                },
                {
                  title: "2025 End-of-Year Report",
                  client: "Client: Boone County Prosecutors' Office",
                  embedSrc: "https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8?poster=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.png%3Fwidth%3D1280%26height%3D720%26time%3D11",
                },
              ].map((item, idx) => (
                <Card
                  key={idx}
                  className="group overflow-hidden shadow-lg transition-all duration-300"
                  style={{ backgroundColor: "#262622", border: "1px solid #3A3A36" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#3A3A36")}
                >
                  <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: "#1A1A18" }}>
                    <iframe
                      src={item.embedSrc}
                      style={{ width: "100%", height: "100%", border: "none" }}
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                      title={item.title}
                    />
                  </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-2xl sm:text-3xl font-semibold mb-2" style={{ color: "var(--paper)" }}>{item.title}</h3>
                    <p className="text-sm sm:text-base" style={{ color: "#9A9A95" }}>{item.client}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section - with red label (urgent/action) */}
        <section id="connect" className="py-16 sm:py-24 label-border-red" style={{ backgroundColor: "var(--ink)", paddingLeft: "1rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-block px-3 py-1 mb-4 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--red)", color: "var(--paper)" }}>
                Get Started
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6" style={{ color: "var(--paper)" }}>
                Let's make something together.
              </h2>
              <p className="text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "#9A9A95" }}>
                Ready to tell your story? Get in touch and let's discuss your next video project.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 max-w-6xl mx-auto">
              <Card className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#262622" }}>
                <h3 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: "var(--paper)" }}>Get In Touch</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "var(--orange)" }}>
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: "var(--paper)" }}>Phone</p>
                      <a
                        href="tel:+18595121419"
                        className="transition-colors"
                        style={{ color: "var(--orange)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--orange)")}
                      >
                        (859) 512-1419
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "var(--orange)" }}>
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: "var(--paper)" }}>Email</p>
                      <a
                        href="mailto:hello@oliverstreetcreative.com"
                        className="transition-colors"
                        style={{ color: "var(--orange)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--orange)")}
                      >
                        hello@oliverstreetcreative.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "var(--orange)" }}>
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: "var(--paper)" }}>Studio</p>
                      <p style={{ color: "#9A9A95" }}>
                        521 Oliver St<br />
                        Covington, KY 41014
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "var(--orange)" }}>
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2L20,8V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2H14M18,20V9H13V4H6V20H18Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold mb-1" style={{ color: "var(--paper)" }}>Contact Card</p>
                      <a
                        href="/sam-patton-contact.vcf"
                        download="Sam Patton - Oliver Street Creative.vcf"
                        className="inline-flex items-center gap-2 text-sm transition-colors"
                        style={{ color: "var(--orange)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--orange)")}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
                        </svg>
                        Download Contact Card
                      </a>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#262622" }}>
                <h3 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: "var(--paper)" }}>Ready to Start?</h3>
                <p className="mb-8 leading-relaxed" style={{ color: "#9A9A95" }}>
                  Book a free consultation call to discuss your video production needs. We'll help you create content
                  that moves hearts, builds trust, and closes deals.
                </p>
                <Button
                  size="lg"
                  asChild
                  className="w-full text-lg py-4"
                  style={{ backgroundColor: "var(--orange)", color: "var(--paper)" }}
                >
                  <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                    Schedule Free Consultation
                  </a>
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 sm:py-12" style={{ backgroundColor: "#0A0A08", borderTop: "1px solid #2A2A26" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg sm:text-xl font-bold mb-2" style={{ color: "var(--paper)" }}>Oliver Street Creative</p>
            <p className="mb-4" style={{ color: "#9A9A95" }}>Professional Video Production in Covington, KY</p>
            <div className="flex justify-center gap-6 mb-4">
              <a
                href="https://x.com/oliverstreet521"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors"
                style={{ color: "#9A9A95" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A95")}
                aria-label="Follow us on Twitter"
              >
                <span className="text-sm">Twitter</span>
              </a>
              <a
                href="https://www.instagram.com/oliverstreetcreative/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors"
                style={{ color: "#9A9A95" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A95")}
                aria-label="Follow us on Instagram"
              >
                <span className="text-sm">Instagram</span>
              </a>
            </div>
            <p className="text-sm" style={{ color: "#5A5A55" }}>© 2025 Oliver Street Creative. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
