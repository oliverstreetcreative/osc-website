// The muted reel at the top of the homepage (Sam, 10/3/26 01:20: "We need you to put
// together a reel of video images that play on the main site. That's just a must on a
// video site you know?").
//
// RENDER → APPROVE → COPY. The reel is cut in Resolve (timeline "OSC_Website_Reel",
// selects from the three public /work films only) and Sam approves the render before
// anything is uploaded. Until then `playbackId` stays null and the hero shows the
// poster still: a frame that is already public on /work.
//
// After approval: upload the approved render to Mux with a static MP4 rendition
// (so it plays without a player library everywhere), paste its playback ID here,
// and set `poster` to a frame of the reel itself.

export interface HeroReel {
  /** Mux playback ID of the APPROVED reel. null = not approved yet: poster only. */
  playbackId: string | null
  /** Static rendition file name on the Mux asset, e.g. "highest.mp4". */
  mp4Rendition: string
  /** The still that paints first (and the only thing shown when motion is off). */
  poster: string
}

export const HERO_REEL: HeroReel = {
  playbackId: null,
  mp4Rendition: "highest.mp4",
  // Phoenix's Story's own public poster frame (lib/work-videos.ts, thumbTime 147).
  poster:
    "https://image.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM/thumbnail.webp?width=1920&time=147",
}

export function heroReelSources(reel: HeroReel): { mp4: string | null; hls: string | null } {
  if (!reel.playbackId) return { mp4: null, hls: null }
  return {
    mp4: `https://stream.mux.com/${reel.playbackId}/${reel.mp4Rendition}`,
    hls: `https://stream.mux.com/${reel.playbackId}.m3u8`,
  }
}
