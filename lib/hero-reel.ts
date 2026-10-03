// The muted reel at the top of the homepage (Sam, 10/3/26 01:20: "We need you to put
// together a reel of video images that play on the main site. That's just a must on a
// video site you know?").
//
// RENDER → APPROVE → COPY. The reel is cut in Resolve (timeline "OSC_Website_Reel") and
// Sam approves the render before anything is uploaded. Until then `playbackId` stays
// null and the hero shows the poster still: a frame that is already public on /work.
//
// UPLOAD CHECKLIST for the approved render (Feature 1b, website-redesign SPEC.md):
//   1. Render with NO audio track.
//   2. Create the Mux asset with a public playback policy and
//      static_renditions: [{ resolution: "720p" }, { resolution: "1080p" }]
//      (the new API. NOT legacy mp4_support, whose file names differ, and NOT
//      "highest", which would hand desktops a 4K file from a UHD render).
//   3. Wait until both static renditions are `ready`.
//   4. curl -I https://stream.mux.com/<id>/720p.mp4 and .../1080p.mp4: both 200.
//   5. Paste the playback ID below and point `poster` at a frame of the reel itself.

export const HLS_TYPE = "application/vnd.apple.mpegurl"
/** Below 640 CSS px the reel sits in a 16:9 box across a phone: 720p is plenty. */
export const NARROW = "(max-width: 639px)"

export interface ReelSource {
  src: string
  type: string
  /** a media query: the browser skips this source when it doesn't match */
  media?: string
}

export interface MuxStill {
  playbackId: string
  /** seconds into the video */
  time: number
}

export interface HeroReel {
  /** Mux playback ID of the APPROVED reel. null = not approved yet: poster only. */
  playbackId: string | null
  /** static rendition file names on that Mux asset */
  mp4: { narrow: string; wide: string }
  /** the still that paints first (and the only thing shown when motion is off) */
  poster: MuxStill
}

export const HERO_REEL: HeroReel = {
  playbackId: null,
  mp4: { narrow: "720p.mp4", wide: "1080p.mp4" },
  // Phoenix's Story's own public poster frame (lib/work-videos.ts, thumbTime 147).
  poster: { playbackId: "WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM", time: 147 },
}

export function muxStill(s: MuxStill, width: number): string {
  return `https://image.mux.com/${s.playbackId}/thumbnail.webp?width=${width}&time=${s.time}`
}

/** A poster a phone fetches at 640–1280 px and a desktop at 1920, never both. */
export function posterSet(s: MuxStill): { src: string; srcSet: string } {
  return {
    src: muxStill(s, 1280),
    srcSet: [640, 1280, 1920].map((w) => `${muxStill(s, w)} ${w}w`).join(", "),
  }
}

/** The HLS stream of any public Mux playback ID: capped at 720p on a phone. */
export function hlsSources(playbackId: string): ReelSource[] {
  const hls = `https://stream.mux.com/${playbackId}.m3u8`
  return [
    { src: `${hls}?max_resolution=720p`, type: HLS_TYPE, media: NARROW },
    { src: hls, type: HLS_TYPE },
  ]
}

/**
 * Sources in the order the browser should try them. It takes the first one whose
 * `media` matches and whose type it can play, and moves on if a file is missing.
 * Safari takes the HLS (capped at 720p on a phone). Browsers without HLS take the MP4
 * for their width.
 */
export function heroReelSources(reel: HeroReel): ReelSource[] {
  if (!reel.playbackId) return []
  const mp4 = (file: string) => `https://stream.mux.com/${reel.playbackId}/${file}`
  return [
    ...hlsSources(reel.playbackId),
    { src: mp4(reel.mp4.narrow), type: "video/mp4", media: NARROW },
    { src: mp4(reel.mp4.wide), type: "video/mp4" },
  ]
}
