// Film cards for the public site: the client site's poster card (client.css
// .cs-pcard) with a real still from Mux. Server component.
import Link from "next/link"
import type { WorkVideo } from "@/lib/work-videos"
import { PlayBadge } from "@/app/client/ui"

export function workStill(v: WorkVideo, width = 960) {
  return `https://image.mux.com/${v.playbackId}/thumbnail.webp?width=${width}&time=${v.thumbTime}`
}

export function WorkCards({
  videos,
  describe = false,
  heading: H = "h3",
}: {
  videos: WorkVideo[]
  describe?: boolean
  /** h2 when the cards sit right under the page's h1 (/work) */
  heading?: "h2" | "h3"
}) {
  return (
    <div className="site-posters site-posters-paper">
      {videos.map((v) => (
        <Link key={v.slug} href={`/work/${v.slug}`} className="cs-card cs-pcard">
          <div className="cs-poster">
            {/* alt="": the title is right below, inside the same link */}
            <img src={workStill(v)} alt="" loading="lazy" />
            <PlayBadge />
          </div>
          <div className="cs-pcard-body">
            <H>{v.title}</H>
            <p className="site-pcard-client">{v.client}</p>
            {describe ? <p>{v.description}</p> : null}
            <div className="site-logo-row">
              <img src={v.clientLogo} alt="" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function TalkCard() {
  return (
    <aside className="cs-help site-talk">
      <p>
        Let&rsquo;s make something together.
        <small>Text or call (859) 512-1419 · hello@oliverstreetcreative.com</small>
      </p>
      <div className="cs-help-act">
        <a className="cs-btn light sm" href="/#contact">
          Get in touch
        </a>
      </div>
    </aside>
  )
}
