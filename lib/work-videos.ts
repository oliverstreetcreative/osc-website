// The video library. Every Mux-hosted piece OSC can show lives here.
//
// - WORK_VIDEOS: the public portfolio — each gets a /work/<slug> page and a
//   card in the homepage portfolio band. Keep this list SHORT (three) — the
//   band says "more sample work by request" for the rest.
// - LIBRARY_VIDEOS: everything, including unlisted pieces that only appear in
//   curated /for/<prospect> pulls (see lib/for-pages.ts).
//
// New entries are normally added by the osc-portfolio skill after a Mux upload.

export interface WorkVideo {
  slug: string
  title: string
  client: string
  clientName: string
  clientLogo: string
  isLightLogo?: boolean
  playbackId: string
  /** seconds into the video used for the poster/thumbnail frame */
  thumbTime: number
  /** optional Mux player accent color, e.g. "#E07830" */
  accentColor?: string
  description: string
}

export function muxThumbnail(v: WorkVideo): string {
  return `https://image.mux.com/${v.playbackId}/thumbnail.webp?width=1920&time=${v.thumbTime}`
}

export function muxEmbedSrc(v: WorkVideo): string {
  const thumb = encodeURIComponent(muxThumbnail(v))
  const accent = v.accentColor
    ? `accent-color=${encodeURIComponent(v.accentColor)}&`
    : ""
  return `https://player.mux.com/${v.playbackId}?${accent}thumbnail_time=${v.thumbTime}&thumbnail_url=${thumb}&poster=${thumb}`
}

// ---------------------------------------------------------------------------
// The public portfolio — three pieces, no more.
// ---------------------------------------------------------------------------

export const WORK_VIDEOS: WorkVideo[] = [
  {
    slug: "phoenixs-story",
    title: "Phoenix's Story",
    client: "Learning Grove, Gala Event 2025",
    clientName: "Learning Grove",
    clientLogo: "/client-logos/learning-grove-logo.png",
    playbackId: "WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM",
    thumbTime: 147,
    description:
      "A fundraising story film for Learning Grove, premiered at their 2025 gala.",
  },
  {
    slug: "boone-county-2025",
    title: "2025 End-of-Year Report",
    client: "Boone County Prosecutors' Office",
    clientName: "Boone County Prosecutors' Office",
    clientLogo: "/client-logos/boone-county-logo-white-text.png",
    isLightLogo: true,
    playbackId: "IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8",
    thumbTime: 104,
    description:
      "An end-of-year report film for the Boone County Prosecutors' Office.",
  },
  {
    slug: "janells-story",
    title: "Janell's Story",
    client: "Beech Acres, Love Grows Here Event 2024",
    clientName: "Beech Acres",
    clientLogo: "/client-logos/beech-acres-logo.png",
    playbackId: "cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co",
    thumbTime: 238,
    accentColor: "#E07830",
    description:
      "A story film for Beech Acres Parenting Center, premiered at the 2024 Love Grows Here breakfast.",
  },
]

// ---------------------------------------------------------------------------
// Unlisted pieces — no public page; available to /for/<prospect> pulls.
// ---------------------------------------------------------------------------

export const UNLISTED_VIDEOS: WorkVideo[] = [
  {
    slug: "widening-the-lens",
    title: "Widening The Lens",
    client: "Learning Grove",
    clientName: "Learning Grove",
    clientLogo: "/client-logos/learning-grove-logo.png",
    playbackId: "nemEDduO54TJY02tCO1XtzSbFUfgVii1cUtSbiEpcAV4",
    thumbTime: 200,
    description: "A documentary film for Learning Grove's Widening The Lens initiative.",
  },
  {
    slug: "widening-the-lens-taft",
    title: "Widening The Lens — Taft",
    client: "Learning Grove",
    clientName: "Learning Grove",
    clientLogo: "/client-logos/learning-grove-logo.png",
    playbackId: "2kvmflozQYx02uNHKyYegHDUTg02vcDb1PDmjoRodT9Zk",
    thumbTime: 40,
    description: "The Taft companion film from Learning Grove's Widening The Lens initiative.",
  },
]

export const LIBRARY_VIDEOS: WorkVideo[] = [...WORK_VIDEOS, ...UNLISTED_VIDEOS]

export function getWorkVideo(slug: string): WorkVideo | undefined {
  return WORK_VIDEOS.find((v) => v.slug === slug)
}

export function getLibraryVideo(slug: string): WorkVideo | undefined {
  return LIBRARY_VIDEOS.find((v) => v.slug === slug)
}
