"use client"

// A film that loads its player only when someone asks for it: a poster and a play
// button until the tap, then the Mux player (autoplaying, since they asked). Keeps
// player.mux.com, its scripts and its analytics off the page for everyone who
// only scrolls past.

import { useState } from "react"

export function MuxFacade({ src, poster, title }: { src: string; poster: string; title: string }) {
  const [on, setOn] = useState(false)
  return (
    <div className="cs-player">
      {on ? (
        <iframe
          src={`${src}${src.includes("?") ? "&" : "?"}autoplay=true`}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" className="site-facade" onClick={() => setOn(true)} aria-label={`Play: ${title}`}>
          <img src={poster} alt="" loading="lazy" />
          <span className="cs-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l10.5-6.5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
