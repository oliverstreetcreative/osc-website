"use client"

// The muted autoplay reel behind a hero. One pattern for every public page
// (homepage, silo pages): the same idea as the /service-businesses hook, plus the
// manners a phone deserves.
//
//   poster first   the still paints with the HTML (no JS needed); the video fades
//                  in only once it is actually playing
//   muted, loop, playsinline, no controls, no sound ever
//   stays a still  for prefers-reduced-motion, Save-Data and 2G connections: no
//                  video bytes are fetched until the viewer taps play
//   pauses         when scrolled out of view, and on the viewer's tap (WCAG 2.2.2)
//   sources        HLS first (Safari plays it natively), then a static MP4 (plays
//                  everywhere). If the browser can play neither, it stays a still.

import { useEffect, useRef, useState } from "react"

type Props = {
  poster: string
  mp4?: string | null
  hls?: string | null
  /** start this many seconds in (media fragment) */
  startAt?: number
}

const HLS_TYPE = "application/vnd.apple.mpegurl"

function playable(mp4?: string | null, hls?: string | null): boolean {
  if (typeof document === "undefined") return false
  const probe = document.createElement("video")
  return Boolean((hls && probe.canPlayType(HLS_TYPE)) || (mp4 && probe.canPlayType("video/mp4")))
}

function quietByChoice(): boolean {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const slow = Boolean(c?.saveData) || c?.effectiveType === "slow-2g" || c?.effectiveType === "2g"
  return reduce || slow
}

export function HeroReel({ poster, mp4, hls, startAt }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const heldByViewer = useRef(false)
  const [canPlay, setCanPlay] = useState(false) // the browser can play one of the sources
  const [mounted, setMounted] = useState(false) // the <video> is in the page
  const [shown, setShown] = useState(false) // a frame is actually playing
  const [paused, setPaused] = useState(true)

  useEffect(() => {
    if (!playable(mp4, hls)) return
    setCanPlay(true)
    if (quietByChoice()) {
      heldByViewer.current = true
      return
    }
    setMounted(true)
  }, [mp4, hls])

  useEffect(() => {
    const el = box.current
    if (!mounted || !el || !("IntersectionObserver" in window)) return
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = video.current
        if (!v) return
        if (!entry.isIntersecting) v.pause()
        else if (!heldByViewer.current) v.play().catch(() => {})
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  const frag = startAt ? `#t=${startAt}` : ""

  function toggle() {
    if (!mounted) {
      heldByViewer.current = false
      setMounted(true) // autoplay starts it
      return
    }
    const v = video.current
    if (!v) return
    if (v.paused) {
      heldByViewer.current = false
      v.play().catch(() => {})
    } else {
      heldByViewer.current = true
      v.pause()
    }
  }

  return (
    <div ref={box} className="site-reel">
      <img className="site-reel-poster" src={poster} alt="" decoding="async" fetchPriority="high" />
      {mounted ? (
        <video
          ref={(v) => {
            video.current = v
            if (v) {
              v.muted = true
              v.defaultMuted = true
            }
          }}
          className={`site-reel-video${shown ? " on" : ""}`}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={poster}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            setShown(true)
            setPaused(false)
          }}
          onPause={() => setPaused(true)}
        >
          {hls ? <source src={hls + frag} type={HLS_TYPE} /> : null}
          {mp4 ? <source src={mp4 + frag} type="video/mp4" /> : null}
        </video>
      ) : null}
      {canPlay ? (
        <button type="button" className="site-reel-btn" onClick={toggle} aria-label={paused ? "Play the reel" : "Pause the reel"}>
          {paused ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
          )}
        </button>
      ) : null}
    </div>
  )
}
