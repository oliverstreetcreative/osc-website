// The hub's script key (SPEC §14 v4 #9): one script, one shoot date, in a header, expiring; nothing else opens.
// Run: node --conditions=import --import tsx --test lib/scripts/hubkey.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { mintHubKey, verifyHubKey } from "./server/hubkey"

const A = "11111111-2222-3333-4444-555555555555"
const B = "66666666-7777-8888-9999-000000000000"

test("a key opens its own script on its own date, nothing else, and expires", () => {
  process.env.SCRIPT_HUB_SECRET = "x".repeat(40)
  const key = mintHubKey(A, "2026-10-07")!
  assert.ok(key.startsWith("k1-2026-10-07."))
  assert.equal(verifyHubKey(A, key, new Date("2026-10-07T13:00:00Z")), "2026-10-07")
  assert.equal(verifyHubKey(B, key, new Date("2026-10-07T13:00:00Z")), null, "another script")
  assert.equal(verifyHubKey(A, key.replace("2026-10-07", "2026-10-08"), new Date("2026-10-07T13:00:00Z")), null, "another date")
  assert.equal(verifyHubKey(A, key.slice(0, -2) + "zz", new Date("2026-10-07T13:00:00Z")), null, "a changed secret")
  assert.equal(verifyHubKey(A, key, new Date("2026-10-21T23:00:00Z")), "2026-10-07", "within 14 days")
  assert.equal(verifyHubKey(A, key, new Date("2026-10-22T00:00:01Z")), null, "after 14 days")
  assert.equal(verifyHubKey(A, null), null)
  process.env.SCRIPT_HUB_SECRET = "y".repeat(40)
  assert.equal(verifyHubKey(A, key, new Date("2026-10-07T13:00:00Z")), null, "a rotated secret kills old keys")
  process.env.SCRIPT_HUB_SECRET = "short"
  assert.equal(mintHubKey(A, "2026-10-07"), null, "no keys without a real secret")
  assert.equal(mintHubKey(A, "10/7/2026"), null)
})
