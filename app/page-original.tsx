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
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const heroGalleryRef = useRef<HTMLDivElement>(null)
  const filmCreditsRef = useRef<HTMLDivElement>(null)
  const tvCreditsRef = useRef<HTMLDivElement>(null)

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
    const scrollContainers = [
      { ref: heroGalleryRef, speed: 2.0 },
      { ref: filmCreditsRef, speed: 1.5 },
      { ref: tvCreditsRef, speed: 1.5 },
    ]

    const intervals: NodeJS.Timeout[] = []
    const cleanupFunctions: (() => void)[] = []

    scrollContainers.forEach(({ ref, speed }) => {
      if (ref.current) {
        let isHovered = false
        let isTouching = false
        let isPausedAtEnd = false
        const container = ref.current

        const handleMouseEnter = () => {
          isHovered = true
        }
        const handleMouseLeave = () => {
          isHovered = false
        }

        const handleTouchStart = () => {
          isTouching = true
        }
        const handleTouchEnd = () => {
          setTimeout(() => {
            isTouching = false
          }, 1000)
        }

        container.addEventListener("mouseenter", handleMouseEnter)
        container.addEventListener("mouseleave", handleMouseLeave)
        container.addEventListener("touchstart", handleTouchStart, { passive: true })
        container.addEventListener("touchend", handleTouchEnd, { passive: true })

        const interval = setInterval(() => {
          if (!isHovered && !isTouching && !isPausedAtEnd && container) {
            const maxScroll = container.scrollWidth - container.clientWidth
            if (container.scrollLeft >= maxScroll) {
              isPausedAtEnd = true
              container.style.transition = "opacity 0.5s ease-in-out"
              container.style.opacity = "0"

              setTimeout(() => {
                if (container) {
                  container.scrollLeft = 0
                  setTimeout(() => {
                    if (container) {
                      container.style.opacity = "1"
                      setTimeout(() => {
                        if (container) {
                          container.style.transition = ""
                          isPausedAtEnd = false
                        }
                      }, 500)
                    }
                  }, 100)
                }
              }, 500)
            } else {
              container.scrollLeft += speed
            }
          }
        }, 16)

        intervals.push(interval)

        cleanupFunctions.push(() => {
          container.removeEventListener("mouseenter", handleMouseEnter)
          container.removeEventListener("mouseleave", handleMouseLeave)
          container.removeEventListener("touchstart", handleTouchStart)
          container.removeEventListener("touchend", handleTouchEnd)
        })
      }
    })

    return () => {
      intervals.forEach((interval) => clearInterval(interval))
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [tmdbData])

  useEffect(() => {
    console.log("[v0] Starting image cycling interval")
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % 3
        console.log("[v0] Cycling to image index:", nextIndex)
        return nextIndex
      })
    }, 4000) // Changed from 3000ms to 4000ms for 4 second intervals

    return () => {
      console.log("[v0] Cleaning up image cycling interval")
      clearInterval(interval)
    }
  }, [])

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 px-4 py-2 rounded text-white font-medium"
        style={{ backgroundColor: "#ff9300" }}
      >
        Skip to main content
      </a>

      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <a href="#hero" className="text-xl sm:text-2xl font-bold text-gray-900 font-heading uppercase">
              Oliver Street Creative
            </a>

            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#hero"
                className="text-gray-700 transition-colors"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Home
              </a>
              <a
                href="#about"
                className="text-gray-700 transition-colors"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                About
              </a>
              <a
                href="#portfolio"
                className="text-gray-700 transition-colors"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Portfolio
              </a>
              <a
                href="#connect"
                className="text-gray-700 transition-colors"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Contact
              </a>
              <a
                href="https://portal.oliverstreetcreative.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 transition-colors"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Client Portal
              </a>
              <Button
                asChild
                style={{ backgroundColor: "#ff9300", borderColor: "#ff9300" }}
                className="hover:opacity-90"
              >
                <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                  Book Call
                </a>
              </Button>
            </div>

            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 text-gray-700 transition-colors"
              style={{ color: "inherit" }}
              onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
              onMouseLeave={(e) => (e.target.style.color = "inherit")}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-4 space-y-4">
              <a
                href="#hero"
                onClick={closeMobileMenu}
                className="block text-lg text-gray-700 transition-colors py-2"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Home
              </a>
              <a
                href="#about"
                onClick={closeMobileMenu}
                className="block text-lg text-gray-700 transition-colors py-2"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                About
              </a>
              <a
                href="#portfolio"
                onClick={closeMobileMenu}
                className="block text-lg text-gray-700 transition-colors py-2"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Portfolio
              </a>
              <a
                href="#connect"
                onClick={closeMobileMenu}
                className="block text-lg text-gray-700 transition-colors py-2"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Contact
              </a>
              <a
                href="https://portal.oliverstreetcreative.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                className="block text-lg text-gray-700 transition-colors py-2"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.target.style.color = "#ff9300")}
                onMouseLeave={(e) => (e.target.style.color = "inherit")}
              >
                Client Portal
              </a>
              <Button
                size="lg"
                asChild
                className="w-full text-lg py-4"
                style={{ backgroundColor: "#ff9300", borderColor: "#ff9300" }}
              >
                <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                  Schedule Free Consultation
                </a>
              </Button>
            </div>
          </div>
        )}
      </nav>

      <main id="main-content">
        <section
          id="hero"
          className="pt-16 sm:pt-20 min-h-screen flex items-center bg-gradient-to-br from-gray-50 to-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <div className="text-center">
              <div className="mb-8 sm:mb-12">
                <img
                  src="/logo.png"
                  alt="Oliver Street Creative - Professional Video Production"
                  className="mx-auto h-48 sm:h-64 md:h-80 lg:h-96 xl:h-[28rem] w-auto"
                />
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-8 sm:mb-12 leading-tight font-heading">
                <span className="block">Stories that move hearts,</span>
                <span className="block">build trust and</span>
                <span className="block" style={{ color: "#ff9300" }}>
                  close deals<span className="text-gray-900">.</span>
                </span>
              </h1>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
                <Button
                  size="lg"
                  asChild
                  className="w-full sm:w-auto text-lg px-8 py-4"
                  style={{ backgroundColor: "#ff9300", borderColor: "#ff9300" }}
                >
                  <a href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
                    Book A Call
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full sm:w-auto text-lg px-8 py-4 bg-transparent"
                >
                  <a href="#about">Learn More</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left side - Image */}
              <div className="order-2 lg:order-1">
                <div className="aspect-[4/3] relative overflow-hidden rounded-lg">
                  <img
                    src="/images/strategic-videos-hero-new.png"
                    alt="Professional videographer holding high-end cinema camera with professional equipment against black background"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Right side - Content */}
              <div className="order-1 lg:order-2 text-white text-center lg:text-left">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 font-heading leading-tight">
                  We make strategic videos for businesses and non-profits
                </h2>
                <p className="text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed">
                  With our own gear and hands-on management, we are full-service from concept to delivery. We bring
                  speed, flexibility, and higher production value - crafting video stories that move both your audience
                  and your bottom line.
                </p>

                {/* Icons */}
                <div className="flex justify-start w-full">
                  <img
                    src="/images/strategic-video-icons.png"
                    alt="Four icons representing consultation, video production, playback, and analytics services"
                    className="w-full max-w-md h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-gray-900 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 font-heading" style={{ color: "#ffffff" }}>
                We've worked on a lot of movies.
              </h2>
              <p className="text-lg sm:text-xl max-w-2xl mx-auto text-balance" style={{ color: "#d1d5db" }}>
                We've spent years on Hollywood film sets, and that experience shapes every video we make.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div
                  className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
                  style={{ borderBottomColor: "#ff9300" }}
                ></div>
                <p className="mt-4 text-gray-300">Loading filmography...</p>
              </div>
            ) : tmdbData ? (
              <div className="relative">
                <div
                  ref={heroGalleryRef}
                  className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    touchAction: "pan-x",
                  }}
                >
                  {(() => {
                    const jobImportance = {
                      Director: 1,
                      Producer: 2,
                      "Executive Producer": 2,
                      "Co-Producer": 2,
                      "Associate Producer": 2,
                      "Supervising Producer": 2,
                      "Production Manager": 3,
                      "Unit Production Manager": 3,
                      "Production Supervisor": 4,
                      "Production Accountant": 5,
                      "Payroll Accountant": 6,
                      "First Assistant Accountant": 7,
                      "Production Coordinator": 8,
                      "Production Secretary": 9,
                      "Key Set Production Assistant": 10,
                      Clerk: 11,
                      "Production Assistant": 12,
                    }

                    const getJobPriority = (job: string) => {
                      if (jobImportance[job as keyof typeof jobImportance]) {
                        return jobImportance[job as keyof typeof jobImportance]
                      }

                      if (job.toLowerCase().includes("director")) return 1
                      if (job.toLowerCase().includes("producer")) return 2
                      if (job.toLowerCase().includes("production manager")) return 3
                      if (job.toLowerCase().includes("production supervisor")) return 4
                      if (job.toLowerCase().includes("production accountant")) return 5
                      if (job.toLowerCase().includes("payroll accountant")) return 6
                      if (job.toLowerCase().includes("first assistant accountant")) return 7
                      if (job.toLowerCase().includes("production coordinator")) return 8
                      if (job.toLowerCase().includes("production secretary")) return 9
                      if (job.toLowerCase().includes("key set production assistant")) return 10
                      if (job.toLowerCase().includes("clerk")) return 11
                      if (job.toLowerCase().includes("production assistant")) return 12

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
                        if (a.releaseDate && !b.releaseDate) return -1
                        if (!a.releaseDate && b.releaseDate) return 1
                        return 0
                      })
                      .map((credit: any) => (
                        <div key={`${credit.type}-${credit.id}`} className="flex-shrink-0 group relative">
                          <div className="w-32 sm:w-40 aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shadow-lg relative">
                            {credit.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w300${credit.poster_path}`}
                                alt={credit.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                <span className="text-gray-400 text-xs text-center px-2">{credit.title}</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center p-3 text-center">
                              <h3 className="text-white font-bold text-sm mb-1 uppercase">{credit.title}</h3>
                              {credit.year && <p className="text-gray-300 text-xs mb-2">({credit.year})</p>}
                              <div className="text-xs" style={{ color: "#ff9300" }}>
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
                <p className="text-gray-400">Unable to load filmography at this time.</p>
              </div>
            )}
          </div>
        </section>

        <section id="about" className="py-16 sm:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 font-heading">
                People like working with us.
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Don't just take our word for it—hear from the founders, nonprofits, and developers we've helped tell
                their stories.
              </p>
            </div>

            <div className="max-w-4xl mx-auto mb-12 sm:mb-16">
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
                <iframe
                  src="https://player.mux.com/4YKpfx6WR7jjcdOfh2LcZfflSqwvz2k52TMNUcXbA28?accent-color=%23ff9300"
                  style={{ width: "100%", height: "100%", border: "none", aspectRatio: "16/9" }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  title="Client Testimonial Video"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 sm:mb-16">
              <Card className="p-6 sm:p-8 border-0 shadow-lg hover:shadow-xl transition-shadow">
                <div className="mb-4">
                  <p className="text-gray-600 italic leading-relaxed">
                    "The partnership with Oliver Street Creative was so valuable in understanding our goals and our
                    values and the mission and impact that we wanted to communicate."
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Jordan Huizinga</p>
                  <p className="text-sm text-gray-500">VP of Development, Beech Acres</p>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg">
                <div className="mb-4">
                  <p className="text-gray-600 italic leading-relaxed">
                    "It comes down to content, creativity, creative editing, and storytelling. That's what separates the
                    crowd from working with Oliver Street."
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Al Haehnle</p>
                  <p className="text-sm text-gray-500">Director, Landslide Films</p>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg md:col-span-2 lg:col-span-1">
                <div className="mb-4">
                  <p className="text-gray-600 italic leading-relaxed">
                    "Oliver Street brought a level of depth and soul to our production that we wouldn't have had
                    otherwise."
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Louis Kelly</p>
                  <p className="text-sm text-gray-500">Boone County Prosecutor</p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 font-heading" style={{ color: "#ffffff" }}>
                We are different than other companies.
              </h2>
              <p className="text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "#d1d5db" }}>
                We are a partner, not just a vendor.
              </p>
            </div>

            <div className="mb-12 sm:mb-16">
              <div className="max-w-4xl mx-auto">
                <div className="aspect-[3/2] relative overflow-hidden rounded-lg">
                  {["/IMG_5148.png", "/IMG_5111.jpeg", "/IMG_5114.jpeg"].map((src, index) => (
                    <img
                      key={index}
                      src={src || "/placeholder.svg"}
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
              <Card className="p-6 sm:p-8 border-0 shadow-lg hover:shadow-xl transition-shadow bg-slate-800 border-slate-700">
                <div className="mb-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "#fff4e6" }}
                  >
                    <img src="/filmstrip.png" alt="Film strip icon" className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 font-heading">
                    We know what we're doing.
                  </h3>
                  <p className="leading-relaxed" style={{ color: "#d1d5db" }}>
                    We love telling stories with cameras. We obsess over the big picture and the smallest details. We
                    strive to make each story we tell not just memorable, but unforgettable.
                  </p>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg hover:shadow-xl transition-shadow bg-slate-800 border-slate-700">
                <div className="mb-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "#fff4e6" }}
                  >
                    <img src="/shield.png" alt="Shield with checkmark icon" className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 font-heading">We tell the truth.</h3>
                  <p className="leading-relaxed" style={{ color: "#d1d5db" }}>
                    Most video companies churn out inauthentic ads and sterile corporate content. We create stories that
                    build trust. For developers, nonprofits, and founders, truth—not hype—closes deals.
                  </p>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg hover:shadow-xl transition-shadow bg-slate-800 border-slate-700">
                <div className="mb-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "#fff4e6" }}
                  >
                    <img src="/trophy.png" alt="Trophy icon" className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 font-heading">We win when you win.</h3>
                  <p className="leading-relaxed" style={{ color: "#d1d5db" }}>
                    Owning our gear and managing every step gives us flexibility others can't match. We capture more,
                    revise as needed, and pivot fast when plans change. We can even defer part of our compensation and
                    tie it to your success—so when you win, we win together.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="portfolio" className="py-16 sm:py-24 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 font-heading">
                Check out our work.
              </h2>
              <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto text-balance">
                Here are a few of the stories we've had the privilege to tell.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
              <Card
                className="group overflow-hidden bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
                style={{ "--hover-border-color": "#ff9300" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ff9300")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <div className="aspect-video bg-gray-200 relative overflow-hidden">
                  <iframe
                    src="https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?metadata-video-title=Janell%27s+Story&video-title=Janell%27s+Story&accent-color=%23ff9300"
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                    title="Janell's Story"
                  />
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-2 font-heading">Janell's Story</h3>
                  <p className="text-gray-300 text-sm sm:text-base">Client: Beech Acres, Love Grows Here Event 2024</p>
                </div>
              </Card>

              {[2, 3].map((item) => (
                <Card
                  key={item}
                  className="group overflow-hidden bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ff9300")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                >
                  <div className="aspect-video bg-gray-200 relative overflow-hidden">
                    {item === 2 ? (
                      <iframe
                        src="https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM?poster=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.png%3Fwidth%3D1280%26height%3D720%26time%3D147"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          transform: "scale(1.01)",
                          transformOrigin: "center",
                        }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                        allowFullScreen
                        title="Phoenix's Story"
                      />
                    ) : item === 3 ? (
                      <iframe
                        src="https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8?poster=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.png%3Fwidth%3D1280%26height%3D720%26time%3D11"
                        style={{ width: "100%", height: "100%", border: "none" }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                        allowFullScreen
                        title="2025 End-of-Year Report"
                      />
                    ) : (
                      <>
                        <img
                          src={`/professional-video-production-sample-.png?height=300&width=400&query=professional video production sample ${item}`}
                          alt={`Portfolio item ${item}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 transition-opacity"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z" />
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 font-heading">
                      {item === 2 ? "Phoenix's Story" : item === 3 ? "2025 End-of-Year Report" : `Project Title ${item}`}
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base">
                      {item === 2
                        ? "Client: Learning Grove, Gala Event 2025"
                        : item === 3
                          ? "Client: Boone County Prosecutors' Office"
                          : "Professional video production showcasing authentic storytelling."}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="connect" className="py-16 sm:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 font-heading">
                Let's make something together.
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Ready to tell your story? Get in touch and let's discuss your next video project.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 max-w-6xl mx-auto">
              <Card className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#fff4e6" }}>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 font-heading">Get In Touch</h3>
                <div className="space-y-6">
                  {!captchaVerified && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          onChange={(e) => setCaptchaVerified(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-gray-300 text-orange-600 focus:ring-orange-500"
                          style={{ accentColor: "#ff9300" }}
                        />
                        <span className="text-gray-700 font-medium">I'm not a robot</span>
                      </label>
                    </div>
                  )}

                  {captchaVerified && (
                    <>
                      <div className="flex items-start gap-4">
                        <svg className="w-6 h-6 mt-1 flex-shrink-0" fill="#ff9300" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                          <path d="M8 21v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Phone</p>
                          <a
                            href="tel:+18595121419"
                            className="transition-colors"
                            style={{ color: "#ff9300" }}
                            onMouseEnter={(e) => (e.target.style.color = "#e6840a")}
                            onMouseLeave={(e) => (e.target.style.color = "#ff9300")}
                          >
                            (859) 512-1419
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <svg className="w-6 h-6 mt-1 flex-shrink-0" fill="#ff9300" viewBox="0 0 24 24">
                          <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Email</p>
                          <a
                            href="mailto:hello@oliverstreetcreative.com"
                            className="transition-colors"
                            style={{ color: "#ff9300" }}
                            onMouseEnter={(e) => (e.target.style.color = "#e6840a")}
                            onMouseLeave={(e) => (e.target.style.color = "#ff9300")}
                          >
                            hello@oliverstreetcreative.com
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <svg className="w-6 h-6 mt-1 flex-shrink-0" fill="#ff9300" viewBox="0 0 24 24"></svg>
                        <div>
                          <p className="font-semibold text-gray-900">Studio</p>
                          <p className="text-gray-600">
                            521 Oliver St
                            <br />
                            Covington, KY 41014
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <svg className="w-6 h-6 mt-1 flex-shrink-0" fill="#ff9300" viewBox="0 0 24 24">
                          <path d="M14,2L20,8V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2H14M18,20V9H13V4H6V20H18Z" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Contact Card</p>
                          <a
                            href="/sam-patton-contact.vcf"
                            download="Sam Patton - Oliver Street Creative.vcf"
                            className="inline-flex items-center gap-2 text-sm transition-colors"
                            style={{ color: "#ff9300" }}
                            onMouseEnter={(e) => (e.target.style.color = "#e6840a")}
                            onMouseLeave={(e) => (e.target.style.color = "#ff9300")}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14,2L20,8V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2H14M18,20V9H13V4H6V20H18Z" />
                            </svg>
                            Download Contact Card
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "#fff4e6" }}>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 font-heading">Ready to Start?</h3>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Book a free consultation call to discuss your video production needs. We'll help you create content
                  that moves hearts, builds trust, and closes deals.
                </p>
                <Button
                  size="lg"
                  asChild
                  className="w-full text-lg py-4"
                  style={{ backgroundColor: "#ff9300", borderColor: "#ff9300" }}
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

      <footer className="bg-black text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg sm:text-xl font-bold mb-2">Oliver Street Creative</p>
            <p className="text-gray-300 mb-4">Professional Video Production in Covington, KY</p>
            <div className="flex justify-center gap-6 mb-4">
              <a
                href="https://x.com/oliverstreet521"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                aria-label="Follow us on Twitter"
              >
                <span className="text-sm">Twitter</span>
              </a>
              <a
                href="https://www.instagram.com/oliverstreetcreative/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                aria-label="Follow us on Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"></svg>
                <span className="text-sm">Instagram</span>
              </a>
            </div>
            <p className="text-sm text-gray-500">© 2025 Oliver Street Creative. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
