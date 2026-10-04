// Mux SIGNED playback for the client's footage library (SPEC §23 v2). Server only.
//   Every portal clip is its own signed Mux asset, so nothing plays without a token minted here, per page view, for a
//   signed-in member. Tokens: `v` (video) and `t` (stills). Never `s` (storyboards) or `g`/`d`.
//   - Claims: sub = playback id, aud, exp. For stills the image parameters (time, width) live IN the token: Mux
//     ignores URL parameters when a token is present.
//   - exp is snapped to the hour (2–3 h ahead) and no iat is set, so the same still has the same URL for an hour and
//     the browser can cache it.
//   - Env: MUX_SIGNING_KEY_ID + MUX_SIGNING_KEY (PEM; "\n" escapes allowed) or MUX_SIGNING_KEY_B64 (Mux's own
//     base64 of the PEM). Node's createPrivateKey accepts both PKCS#1 ("RSA PRIVATE KEY") and PKCS#8; jose alone
//     rejects PKCS#1. No key or a bad key → null, and the page says footage is unavailable (fail closed).
import { createPrivateKey, type KeyObject } from "crypto"
import { SignJWT } from "jose"

const WINDOW_S = 3600
const AHEAD_S = 2 * 3600
const ID = /^[A-Za-z0-9]{10,80}$/

type Key = { id: string; key: KeyObject }
let cached: Key | null | undefined

function loadKey(env: NodeJS.ProcessEnv = process.env): Key | null {
  const id = env.MUX_SIGNING_KEY_ID?.trim()
  const pem = env.MUX_SIGNING_KEY?.trim()
    ? env.MUX_SIGNING_KEY.trim().replace(/\\n/g, "\n")
    : env.MUX_SIGNING_KEY_B64?.trim()
      ? Buffer.from(env.MUX_SIGNING_KEY_B64.trim(), "base64").toString("utf8")
      : ""
  if (!id || !pem) return null
  try {
    return { id, key: createPrivateKey({ key: pem, format: "pem" }) }
  } catch (err) {
    console.error("mux-sign: the signing key won't load", (err as Error)?.message)
    return null
  }
}

function signingKey(): Key | null {
  if (cached === undefined) cached = loadKey()
  return cached
}

/** For tests: forget the loaded key (or load from a given env). */
export function resetSigningKey(env?: NodeJS.ProcessEnv) {
  cached = env ? loadKey(env) : undefined
}

export const signingReady = () => signingKey() !== null

/** The token's expiry: 2–3 hours ahead, on the hour (identical tokens within an hour). */
export const snappedExp = (nowMs: number) => Math.ceil((Math.floor(nowMs / 1000) + AHEAD_S) / WINDOW_S) * WINDOW_S

async function sign(playbackId: string, aud: "v" | "t", extra: Record<string, number>, nowMs: number): Promise<string | null> {
  const k = signingKey()
  if (!k || !ID.test(playbackId)) return null
  return new SignJWT({ ...extra })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: k.id })
    .setSubject(playbackId)
    .setAudience(aud)
    .setExpirationTime(snappedExp(nowMs))
    .sign(k.key)
}

/** A playback token for the clip's signed id (Mux Player: `tokens={{ playback }}`). */
export const playbackToken = (playbackId: string, nowMs = Date.now()) => sign(playbackId, "v", {}, nowMs)

/** A still of the clip at `time` seconds, `width` px wide: the full image URL, or null. */
export async function stillUrl(playbackId: string, opts: { time?: number; width?: number } = {}, nowMs = Date.now()): Promise<string | null> {
  const claims: Record<string, number> = {}
  if (opts.time !== undefined && Number.isFinite(opts.time) && opts.time >= 0) claims.time = Math.round(opts.time * 100) / 100
  if (opts.width !== undefined && Number.isFinite(opts.width)) claims.width = Math.max(64, Math.min(1920, Math.round(opts.width)))
  const token = await sign(playbackId, "t", claims, nowMs)
  return token ? `https://image.mux.com/${playbackId}/thumbnail.webp?token=${token}` : null
}
