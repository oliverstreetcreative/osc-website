"use client"

// The muted autoplay reel behind a hero. One pattern for every public page
// (homepage, silo pages): the same idea as the /service-businesses hook, plus the
// manners a phone deserves.
//
//   poster first   the still paints with the HTML (no JS needed), sized by srcset so a
//                  phone never fetches the 1920 one; the video fades in only once it
//                  is actually playing (it carries no poster of its own: no 2nd fetch)
//   muted, loop, playsinline, no controls, no sound ever
//   stays a still  for prefers-reduced-motion, Save-Data, 2G and 3G: no video bytes
//                  are fetched until the viewer taps play
//   pauses         when scrolled out of view, and on the viewer's tap (WCAG 2.2.2)
//   sources        an ordered list with media queries (lib/hero-reel.ts): HLS capped
//                  at 720p on a phone, HLS, then 720p / 1080p MP4. The browser picks;
//                  a missing file falls through. If it can play none, it stays a still.

import { useEffect, useRef, useState } from "react"
import type { ReelSource } from "@/lib/hero-reel"

type Props = {
  poster: { src: string; srcSet?: string }
  sources: ReelSource[]
  /** start this many seconds in (media fragment) */
  startAt?: number
}

// Can this browser, at this width, play at least one source? (A source whose media query
// doesn't match is one the browser will skip, so it doesn't count.)
function playable(sources: ReelSource[]): boolean {
  if (typeof document === "undefined" || sources.length === 0) return false
  const probe = document.createElement("video")
  return sources.some(
    (s) => (!s.media || (window.matchMedia?.(s.media).matches ?? true)) && probe.canPlayType(s.type) !== "",
  )
}

function quietByChoice(): boolean {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const slow =
    Boolean(c?.saveData) || c?.effectiveType === "slow-2g" || c?.effectiveType === "2g" || c?.effectiveType === "3g"
  return reduce || slow
}

export function HeroReel({ poster, sources, startAt }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const heldByViewer = useRef(false)
  const [canPlay, setCanPlay] = useState(false) // the browser can play one of the sources
  const [mounted, setMounted] = useState(false) // the <video> is in the page
  const [shown, setShown] = useState(false) // a frame is actually playing
  const [paused, setPaused] = useState(true)
  const key = sources.map((s) => s.src).join("|")

  useEffect(() => {
    if (!playable(sources)) return
    setCanPlay(true)
    if (quietByChoice()) {
      heldByViewer.current = true
      return
    }
    setMounted(true)
    // `key` stands for `sources` (a fresh array each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

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
      {/* srcSet and sizes BEFORE src: React sets attributes in prop order on a client
          render, and Safari would start fetching src before it saw the srcset (the same
          reason next/image puts src last). */}
      <img
        className="site-reel-poster"
        srcSet={poster.srcSet}
        sizes={poster.srcSet ? "100vw" : undefined}
        src={poster.src}
        alt=""
        decoding="async"
        fetchPriority="high"
      />
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
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            setShown(true)
            setPaused(false)
          }}
          onPause={() => setPaused(true)}
        >
          {sources.map((s, i) => (
            <source
              key={s.src + (s.media ?? "")}
              src={s.src + frag}
              type={s.type}
              media={s.media}
              // the last source failing means none could play: back to the still, no button
              onError={
                i === sources.length - 1
                  ? () => {
                      setMounted(false)
                      setCanPlay(false)
                    }
                  : undefined
              }
            />
          ))}
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
