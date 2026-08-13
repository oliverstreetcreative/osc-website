import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { WORK_VIDEOS, getWorkVideo } from "@/lib/work-videos"

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return WORK_VIDEOS.map((v) => ({ slug: v.slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const video = getWorkVideo(params.slug)
  if (!video) return {}

  const title = `${video.title} — ${video.clientName} | Oliver Street Creative`
  return {
    title,
    description: video.description,
    alternates: {
      canonical: `https://oliverstreetcreative.com/work/${video.slug}`,
    },
    openGraph: {
      title: `${video.title} — ${video.clientName}`,
      description: video.description,
      url: `https://oliverstreetcreative.com/work/${video.slug}`,
      siteName: "Oliver Street Creative",
      type: "video.other",
      images: [
        {
          url: video.thumbnail,
          width: 1920,
          height: 1080,
          alt: `${video.title} — ${video.client}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${video.title} — ${video.clientName}`,
      description: video.description,
      images: [video.thumbnail],
    },
  }
}

export default function WorkVideoPage({ params }: Props) {
  const video = getWorkVideo(params.slug)
  if (!video) notFound()

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

      {/* Player */}
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
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              backgroundColor: "black",
              overflow: "hidden",
            }}
          >
            <iframe
              src={video.embedSrc}
              title={video.title}
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          </div>

          {/* Title block — mirrors the homepage portfolio cards */}
          <div style={{ padding: "28px 4px 0" }}>
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
                  filter: video.isLightLogo ? "none" : "brightness(0) invert(1)",
                }}
              />
              <h1
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                {video.title}
              </h1>
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

        {/* CTA */}
        <div
          style={{
            marginTop: "64px",
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
              padding: "14px 32px",
              backgroundColor: "#D13B2E",
              color: "white",
              fontSize: "14px",
              fontWeight: 700,
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
        © {new Date().getFullYear()} Oliver Street Creative · Covington, KY ·
        Serving Greater Cincinnati &amp; Northern Kentucky
      </footer>
    </div>
  )
}
