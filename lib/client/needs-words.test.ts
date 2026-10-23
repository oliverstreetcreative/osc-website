// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/needs-words.test.ts
// The words Home's Needs-you cards and a job page's list share (SPEC §28 v2; review 10/6: one wording, no drift).
import { test } from "node:test"
import assert from "node:assert/strict"
import { cutVersion, scriptAsk, shootWhen } from "./needs-words"

test("the shared Needs-you words", () => {
  assert.equal(scriptAsk("ready_for_ok"), "Ready for your OK")
  assert.equal(scriptAsk("ready_for_notes"), "Ready for your notes")
  assert.equal(shootWhen(-1), "Happening now")
  assert.equal(shootWhen(0), "Today")
  assert.equal(shootWhen(1), "Tomorrow")
  assert.equal(shootWhen(5), "In 5 days")
  const review = "https://review.oliverstreetcreative.com/share/9fL6ScEgOSf0cc9A4fkrZb8RgpCiFrALX2xjcgRE6c4"
  // A cut on OSC Review: Review's own number, never the book's label (it may name another cut).
  assert.equal(cutVersion({ review_url: review, version_label: "v8A" }, 3), " · Version 3")
  assert.equal(cutVersion({ review_url: review, version_label: "v8A" }), "")
  // A Frame.io link keeps the book's label.
  assert.equal(cutVersion({ review_url: "https://f.io/abc", version_label: "v2" }), " · v2")
  assert.equal(cutVersion({ review_url: null, version_label: null }), "")
})
