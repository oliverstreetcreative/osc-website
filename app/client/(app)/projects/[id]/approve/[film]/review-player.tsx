"use client"
// The exact version a client is asked to approve, played in place (SPEC §13 v4: "Approve sits under a player of that
// exact version, not a link out"). Review serves HLS: Safari plays it natively; elsewhere hls.js (inside mux-player)
// needs Review to allow this site's origin (CORS). If playback fails, say so and offer Review itself.
import { useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

export function ReviewPlayer({ src, title, reviewUrl }: { src: string | null; title: string; reviewUrl: string }) {
  const [failed, setFailed] = useState(!src)
  if (failed || !src) {
    return (
      <div className="cs-card cs-pad">
        <p>This cut won&rsquo;t play here right now.</p>
        <p style={{ marginTop: 8 }}>
          <a className="cs-btn ghost" href={reviewUrl} target="_blank" rel="noopener">
            Watch it in Review
          </a>
        </p>
      </div>
    )
  }
  return (
    <div className="cs-player" style={{ aspectRatio: "16/9" }}>
      <MuxPlayer src={src} streamType="on-demand" title={title} accentColor="#E07830" disableTracking onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} />
    </div>
  )
}
