// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/hero-reel.test.ts   (cwd = the repo)
// The hero reel's gate (website-redesign, Sam 10/8 ~14:55): reel v6 plays on staging only. Anything that isn't
// positively staging or `next dev` keeps the approved production reel, which is none yet (Phoenix's still).
import { test } from "node:test"
import assert from "node:assert/strict"
import { HERO_REEL, STAGING_REEL, heroReelFor, heroReelSources } from "./hero-reel"

test("the live site keeps the still: no playback id, no sources", () => {
  const live = heroReelFor(false)
  assert.equal(live, HERO_REEL)
  assert.equal(live.playbackId, null)
  assert.deepEqual(heroReelSources(live), [])
})

test("staging plays reel v6: HLS, then the 720p and 1080p static renditions, poster from the reel itself", () => {
  const s = heroReelFor(true)
  assert.equal(s, STAGING_REEL)
  assert.match(s.playbackId ?? "", /^[A-Za-z0-9]{20,}$/)
  assert.equal(s.poster.playbackId, s.playbackId)
  const src = heroReelSources(s).map((x) => x.src)
  assert.ok(src[0].startsWith(`https://stream.mux.com/${s.playbackId}.m3u8`))
  assert.ok(src.includes(`https://stream.mux.com/${s.playbackId}/720p.mp4`))
  assert.ok(src.includes(`https://stream.mux.com/${s.playbackId}/1080p.mp4`))
})
