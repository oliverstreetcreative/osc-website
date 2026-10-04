// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/mux-sign.test.ts
// Signed Mux tokens for the footage library (SPEC §23 v2), against a throwaway RSA key.
import { test } from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync } from "crypto"
import { decodeProtectedHeader, jwtVerify } from "jose"
import { playbackToken, resetSigningKey, signingReady, snappedExp, stillUrl } from "./mux-sign"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const PKCS1 = privateKey.export({ type: "pkcs1", format: "pem" }).toString()
const PKCS8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
const PB = "a1B2c3D4e5F6g7H8i9J0k1L2m3"
const NOW = Date.UTC(2026, 9, 3, 21, 17, 30)

test("no key, no tokens (fail closed)", async () => {
  resetSigningKey({})
  assert.equal(signingReady(), false)
  assert.equal(await playbackToken(PB, NOW), null)
  assert.equal(await stillUrl(PB, { time: 3 }, NOW), null)
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY: "not a key" })
  assert.equal(signingReady(), false)
})

test("a playback token: RS256, kid header, sub = playback id, aud v, snapped exp, no iat", async () => {
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY: PKCS1 }) // the PKCS#1 PEM jose alone would refuse
  const t = (await playbackToken(PB, NOW))!
  const { payload } = await jwtVerify(t, publicKey, { audience: "v", currentDate: new Date(NOW) })
  assert.equal(payload.sub, PB)
  assert.equal(payload.exp, snappedExp(NOW))
  assert.equal(payload.iat, undefined)
  const h = decodeProtectedHeader(t)
  assert.equal(h.alg, "RS256")
  assert.equal(h.kid, "kid1")
})

test("expiry is 2–3 hours ahead on the hour, so tokens repeat within the hour", async () => {
  const exp = snappedExp(NOW)
  assert.equal(exp % 3600, 0)
  assert.ok(exp - NOW / 1000 >= 2 * 3600 && exp - NOW / 1000 <= 3 * 3600)
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY: PKCS8 })
  assert.equal(await playbackToken(PB, NOW), await playbackToken(PB, NOW + 60_000))
})

test("a still: aud t, time + width as claims (Mux ignores URL params with a token), a bounded width", async () => {
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY_B64: Buffer.from(PKCS8).toString("base64") })
  const url = (await stillUrl(PB, { time: 3.14159, width: 400 }, NOW))!
  assert.match(url, new RegExp(`^https://image\\.mux\\.com/${PB}/thumbnail\\.webp\\?token=[^&]+$`))
  const { payload } = await jwtVerify(url.split("token=")[1], publicKey, { audience: "t", currentDate: new Date(NOW) })
  assert.equal(payload.time, 3.14)
  assert.equal(payload.width, 400)
  const wide = (await stillUrl(PB, { width: 99999 }, NOW))!
  assert.equal((await jwtVerify(wide.split("token=")[1], publicKey, { currentDate: new Date(NOW) })).payload.width, 1920)
})

test("an odd playback id never gets a token", async () => {
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY: PKCS8 })
  assert.equal(await playbackToken("../x", NOW), null)
  assert.equal(await stillUrl("abc", {}, NOW), null)
})

test("PEM with \\n escapes (how env vars often carry it) loads", async () => {
  resetSigningKey({ MUX_SIGNING_KEY_ID: "kid1", MUX_SIGNING_KEY: PKCS8.replace(/\n/g, "\\n") })
  assert.equal(signingReady(), true)
})
