import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { WORK_VIDEOS, getWorkVideo, muxEmbedSrc, muxThumbnail } from "@/lib/work-videos"
import { SiteFrame } from "@/components/site/SiteFrame"
import { TalkCard, WorkCards } from "@/components/site/WorkCards"

// One film. Restyled 10/3/26 in the hub's vein: the client site's project page
// (ink hero holding the player, paper below), so a prospect's film page and a
// client's project page look like the same company.

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
          url: muxThumbnail(video),
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
      images: [muxThumbnail(video)],
    },
  }
}

export default function WorkVideoPage({ params }: Props) {
  const video = getWorkVideo(params.slug)
  if (!video) notFound()
  const others = WORK_VIDEOS.filter((v) => v.slug !== video.slug)

  return (
    <SiteFrame current="work">
      <section className="site-film">
        <div className="site-in">
          <Link className="cs-back" href="/work">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All work
          </Link>
          <div className="cs-player site-film-player">
            <iframe
              src={muxEmbedSrc(video)}
              title={video.title}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="site-sec site-film-body">
        <div className="site-in">
          <div className="site-logo-row site-film-logo">
            <img src={video.clientLogo} alt={video.clientName} />
          </div>
          <h1 className="site-h2">{video.title}</h1>
          <p className="site-lede">{video.client}</p>
          <p className="site-film-desc">{video.description}</p>
          <TalkCard />
        </div>
      </section>

      {others.length > 0 ? (
        <section className="site-sec rule">
          <div className="site-in">
            <h2 className="cs-h2">
              <span>More work</span>
              <Link href="/work">See all</Link>
            </h2>
            <WorkCards videos={others} />
          </div>
        </section>
      ) : null}
    </SiteFrame>
  )
}
