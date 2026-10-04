// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/library.test.ts
// The portal's own check of a published footage package (SPEC §23 v2): closed, so nothing extra can ride along even
// if a snapshot were hand-edited after the gate.
import { test } from "node:test"
import assert from "node:assert/strict"
import { Package, clipLength, dayRange } from "./library-shape"

const clip = {
  key: "0123456789abcdef-1048576@100-435",
  sam_event: "0192ab34cd56-1a2b3c4d",
  title: "Day 1 · 10:42 AM",
  taken_on: "2026-06-12",
  fps: 23.976,
  mux_playback_id: "PLAYBACKid0000001",
  mux_asset_id: "ASSETid00000000001",
  duration_s: 14.01,
  thumb_s: 3,
  aspect: "16:9",
}
const pkg = { format: "osc-library/2", org: "acme", project: "p1", job: "26-099", key: "june-broll", title: "June shoot · B-roll", clips: [clip] }

test("a gate snapshot parses", () => {
  assert.equal(Package.parse(pkg).clips.length, 1)
})

test("closed schema: an extra field anywhere fails the whole package", () => {
  assert.equal(Package.safeParse({ ...pkg, notes: "internal" }).success, false)
  assert.equal(Package.safeParse({ ...pkg, clips: [{ ...clip, ai_reason: "smiling child" }] }).success, false)
  assert.equal(Package.safeParse({ ...pkg, clips: [{ ...clip, download: { path: "/Clients/x.mp4" } }] }).success, false)
})

test("shapes: frame keys, Stacks event ids, Mux ids, the format", () => {
  assert.equal(Package.safeParse({ ...pkg, clips: [{ ...clip, key: "x@12.0-26.2" }] }).success, false)
  assert.equal(Package.safeParse({ ...pkg, clips: [{ ...clip, sam_event: "ai-1" }] }).success, false)
  assert.equal(Package.safeParse({ ...pkg, clips: [{ ...clip, mux_playback_id: "../x" }] }).success, false)
  assert.equal(Package.safeParse({ ...pkg, format: "osc-library/1" }).success, false)
})

test("day ranges and clip lengths read like a person wrote them", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`)
  assert.equal(dayRange(d("2026-06-12"), d("2026-06-14")), "Jun 12–14")
  assert.equal(dayRange(d("2026-06-12"), d("2026-06-12")), "Jun 12")
  assert.equal(dayRange(d("2026-06-30"), d("2026-07-02")), "Jun 30 – Jul 2")
  assert.equal(dayRange(null, null), "")
  assert.equal(clipLength(14.01), "0:14")
  assert.equal(clipLength(75.6), "1:16")
})
