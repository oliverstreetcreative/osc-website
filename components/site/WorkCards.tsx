// Film cards for the public site: the client site's poster card (client.css
// .cs-pcard) with a real still from Mux. Server component.
import Link from "next/link"
import type { WorkVideo } from "@/lib/work-videos"
import { PlayBadge } from "@/app/client/ui"

export function workStill(v: WorkVideo, width = 960) {
  return `https://image.mux.com/${v.playbackId}/thumbnail.webp?width=${width}&time=${v.thumbTime}`
}

export function WorkCards({ videos, describe = false }: { videos: WorkVideo[]; describe?: boolean }) {
  return (
    <div className="site-posters site-posters-paper">
      {videos.map((v) => (
        <Link key={v.slug} href={`/work/${v.slug}`} className="cs-card cs-pcard">
          <div className="cs-poster">
            <img src={workStill(v)} alt={`${v.title} - ${v.clientName}`} loading="lazy" />
            <PlayBadge />
          </div>
          <div className="cs-pcard-body">
            <h3>{v.title}</h3>
            <p className="site-pcard-client">{v.client}</p>
            {describe ? <p>{v.description}</p> : null}
            <div className="site-logo-row">
              <img src={v.clientLogo} alt={v.clientName} />
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
