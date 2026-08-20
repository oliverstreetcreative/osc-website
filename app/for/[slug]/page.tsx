import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FOR_PAGES, getForPage } from "@/lib/for-pages"
import {
  getLibraryVideo,
  muxEmbedSrc,
  muxThumbnail,
} from "@/lib/work-videos"

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return FOR_PAGES.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const page = getForPage(params.slug)
  if (!page) return {}

  return {
    title: `Selected work for ${page.prospect} | Oliver Street Creative`,
    description: `A hand-picked selection of Oliver Street Creative films for ${page.prospect}.`,
    // These pages are for one recipient — never for search engines.
    robots: { index: false, follow: false },
  }
}

export default function ForProspectPage({ params }: Props) {
  const page = getForPage(params.slug)
  if (!page) notFound()

  const videos = page.videoSlugs
    .map((slug) => getLibraryVideo(slug))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#141412",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "24px clamp(20px, 5vw, 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <img
            src="/logo.png"
            alt="Oliver Street Creative"
            style={{ height: "64px", width: "auto" }}
          />
        </Link>
        <Link
          href="/#contact"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.7)",
            textDecoration: "none",
          }}
        >
          Work with us
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px clamp(16px, 4vw, 48px) 48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          {/* Headline */}
          <div style={{ padding: "16px 4px 40px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Selected work
            </div>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 48px)",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              For {page.prospect}
            </h1>
            {page.intro && (
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.65)",
                  maxWidth: "640px",
                  margin: "20px 0 0",
                }}
              >
                {page.intro}
              </p>
            )}
          </div>

          {/* Video stack */}
          {videos.map((video) => (
            <div key={video.slug} style={{ marginBottom: "64px" }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  backgroundColor: "black",
                  overflow: "hidden",
                }}
              >
                <iframe
                  src={muxEmbedSrc(video)}
                  title={video.title}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />
              </div>

              <div style={{ padding: "24px 4px 0" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <img
                    src={video.clientLogo}
                    alt={video.clientName}
                    style={{
                      height: "34px",
                      width: "auto",
                      filter: video.isLightLogo
                        ? "none"
                        : "brightness(0) invert(1)",
                    }}
                  />
                  <h2
                    style={{
                      fontSize: "clamp(20px, 3vw, 30px)",
                      fontWeight: 800,
                      letterSpacing: "-0.01em",
                      margin: 0,
                    }}
                  >
                    {video.title}
                  </h2>
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    color: "rgba(255,255,255,0.6)",
                    margin: 0,
                  }}
                >
                  {video.client}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            maxWidth: "640px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "16px",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Oliver Street Creative
          </div>
          <p
            style={{
              fontSize: "clamp(20px, 3vw, 28px)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              marginBottom: "28px",
            }}
          >
            Let's make something together.
          </p>
          <Link
            href="/#contact"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              backgroundColor: "transparent",
              border: "1px solid #E07830",
              color: "#E07830",
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textDecoration: "none",
            }}
          >
            Get in touch
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: "24px clamp(20px, 5vw, 64px)",
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} Oliver Street Creative · Covington, KY
      </footer>
    </div>
  )
}
