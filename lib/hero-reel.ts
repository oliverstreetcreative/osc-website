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

/**
 * Reel v6 on STAGING ONLY (Sam 10/8 ~14:55: "Show me the proposed reel and logo on the website"; Majordomo: on
 * staging only, production still gated until his yes there). The checklist above, done 10/8: the exact master he
 * reviewed (sha256 53a9ce86…), Mux asset B4RDg02r00QQbQOEJztxPa02IPK2tulLjryaDpQA1gMy3s, public playback, static
 * 720p + 1080p both `ready`, HEAD 200 on both (website-redesign reel/v6/mux_v6.json). The poster is a frame of the
 * reel itself: 1 s in, the film's opening (Phoenix and mom).
 */
export const STAGING_REEL: HeroReel = {
  playbackId: "VKmFx82ynR9RPE01IKYWGL5uiDOfP7q02Y01kieyMsHK7E",
  mp4: { narrow: "720p.mp4", wide: "1080p.mp4" },
  poster: { playbackId: "VKmFx82ynR9RPE01IKYWGL5uiDOfP7q02Y01kieyMsHK7E", time: 1 },
}

/**
 * The reel this build shows. `drafts` = lib/faq.ts draftsAllowed(): true only where the build KNOWS it's staging (or
 * `next dev`), so anything else (the live site, or a build that can't tell) keeps HERO_REEL: fails closed.
 */
export function heroReelFor(drafts: boolean): HeroReel {
  return drafts ? STAGING_REEL : HERO_REEL
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
    // last resort at any width, in case the 1080p file is missing (a render under 1080
    // gets no 1080p rendition from Mux): a soft reel beats a dead Play button
    { src: mp4(reel.mp4.narrow), type: "video/mp4" },
  ]
}
