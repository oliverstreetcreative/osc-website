import type { Metadata } from "next"
import Link from "next/link"
import { SiteFrame } from "@/components/site/SiteFrame"
import { MuxFacade } from "@/components/site/MuxFacade"
import { notFound } from "next/navigation"
import { getPortfolioData, logoSrc } from "@/lib/portfolio-data"
import { muxThumbnail, muxEmbedSrc } from "@/lib/work-videos"
import { ProposalBody, ProposalHero } from "./proposal"

interface Props {
  params: { slug: string }
}

// Pull definitions live in Dropbox and are read per-request, so a new
// prospect page is a data change, not a deploy.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pages } = await getPortfolioData()
  const page = pages.find((p) => p.slug === params.slug)
  if (!page) return {}

  const isProposal = Boolean(page.proposal)
  return {
    title: isProposal
      ? `A proposal for ${page.prospect} | Oliver Street Creative`
      : `Selected work for ${page.prospect} | Oliver Street Creative`,
    description: isProposal
      ? `${page.proposal?.headline} A proposal from Oliver Street Creative for ${page.prospect}.`
      : `A hand-picked selection of Oliver Street Creative films for ${page.prospect}.`,
    // These pages are for one recipient — never for search engines.
    robots: { index: false, follow: false },
  }
}

export default async function ForProspectPage({ params }: Props) {
  const { pages, videos: library } = await getPortfolioData()
  const page = pages.find((p) => p.slug === params.slug)
  if (!page) notFound()

  const videos = page.videoSlugs
    .map((slug) => library.find((v) => v.slug === slug))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))

  const prospectMark = (
    <>
      {page.prospectLogo && (
        <img
          src={logoSrc(page.prospectLogo)}
          alt={page.prospect}
          style={{
            height: "clamp(48px, 8vw, 80px)",
            width: "auto",
            filter: page.isLightLogo ? "brightness(0)" : "none",
          }}
        />
      )}
      {(!page.prospectLogo || !page.logoIncludesName) && (
        <span
          style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {page.prospect}
        </span>
      )}
    </>
  )

  return (
    <SiteFrame>
      <div className="site-in prospect-body">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          {page.proposal ? (
            <>
              <ProposalHero proposal={page.proposal} prospect={page.prospect} logo={prospectMark} />
              <ProposalBody proposal={page.proposal} videos={videos} />
            </>
          ) : (
            <>
          {/* Headline */}
          <div style={{ padding: "16px 4px 40px" }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "20px",
                color: "var(--mut)",
              }}
            >
              Selected work for
            </div>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 48px)",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5em",
                flexWrap: "wrap",
              }}
            >
              {page.prospectLogo && (
                <img
                  src={logoSrc(page.prospectLogo)}
                  alt={page.prospect}
                  style={{
                    height: "clamp(48px, 8vw, 80px)",
                    width: "auto",
                    filter: page.isLightLogo
                      ? "brightness(0)"
                      : "none",
                  }}
                />
              )}
              {(!page.prospectLogo || !page.logoIncludesName) && (
                <span>{page.prospect}</span>
              )}
            </h1>
            {page.intro && (
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: 1.6,
                  color: "var(--mut)",
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
                <MuxFacade src={muxEmbedSrc(video)} poster={muxThumbnail(video)} title={video.title} />
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
                        ? "brightness(0)"
                        : "none",
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
                    color: "var(--mut)",
                    margin: 0,
                  }}
                >
                  {video.client}
                </p>
              </div>
            </div>
          ))}
            </>
          )}
        </div>

        {/* CTA */}
        {!page.proposal && (
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
              color: "var(--mut)",
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
              border: "1px solid var(--accent)",
              color: "var(--accent)",
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
        )}
      </div>
    </SiteFrame>
  )
}
