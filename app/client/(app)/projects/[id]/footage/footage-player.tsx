"use client"
// One footage clip (SPEC §23 v2): its own SIGNED Mux asset, so the player gets the playback and poster tokens the
// server minted for this page view. No storyboard token is ever minted. If it won't play, say so plainly.
import { useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

export function FootagePlayer({ playbackId, playback, poster, title, aspect }: {
  playbackId: string
  playback: string | null
  poster: string | null
  title: string
  aspect: string
}) {
  const [failed, setFailed] = useState(!playback)
  if (failed || !playback) {
    return (
      <div className="cs-card cs-pad">
        <p>This clip won&rsquo;t play right now. Try again in a minute.</p>
      </div>
    )
  }
  return (
    <div className="cs-player" style={{ aspectRatio: aspect }}>
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback, thumbnail: poster ?? undefined }}
        streamType="on-demand"
        title={title}
        accentColor="#E07830"
        disableTracking
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
