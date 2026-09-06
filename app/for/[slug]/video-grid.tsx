"use client"

// Selected work as a grid of small tiles that open a big player.
// Sam 9/6/26: "they should be smaller, and pop out big if you choose to play them."

import { useCallback, useEffect, useState } from "react"
import type { WorkVideo } from "@/lib/work-videos"
import { muxEmbedSrc, muxThumbnail } from "@/lib/work-videos"

const ORANGE = "#E07830"
const DIM = "rgba(255,255,255,0.62)"

export function VideoGrid({ videos }: { videos: WorkVideo[] }) {
  const [open, setOpen] = useState<WorkVideo | null>(null)

  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, close])

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
          marginTop: "32px",
        }}
      >
        {videos.map((video) => (
          <button
            key={video.slug}
            type="button"
            onClick={() => setOpen(video)}
            aria-label={`Play ${video.title}`}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "block",
              textAlign: "left",
            }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "16/9",
                backgroundColor: "black",
                overflow: "hidden",
                backgroundImage: `url(${muxThumbnail(video).replace("width=1920", "width=960")})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 60%)",
                }}
              >
                <span
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(20,20,18,0.72)",
                    border: `2px solid ${ORANGE}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
                    <path d="M2 1.5v19l16-9.5z" fill="white" />
                  </svg>
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 2px 0" }}>
              <img
                src={video.clientLogo}
                alt={video.clientName}
                style={{
                  height: "22px",
                  width: "auto",
                  filter: video.isLightLogo ? "none" : "brightness(0) invert(1)",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em", color: "white" }}>
                  {video.title}
                </div>
                <div style={{ fontSize: "13px", color: DIM }}>{video.client}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(12px, 3vw, 40px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(1400px, 100%)" }}
          >
            <div style={{ aspectRatio: "16/9", backgroundColor: "black", width: "100%" }}>
              <iframe
                src={`${muxEmbedSrc(open)}&autoplay=true`}
                title={open.title}
                style={{ width: "100%", height: "100%", border: 0 }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                padding: "16px 2px 0",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={open.clientLogo}
                  alt={open.clientName}
                  style={{ height: "26px", width: "auto", filter: open.isLightLogo ? "none" : "brightness(0) invert(1)" }}
                />
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "white" }}>{open.title}</div>
                  <div style={{ fontSize: "13px", color: DIM }}>{open.client}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: ORANGE,
                  padding: "8px 4px",
                }}
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
