import { SignJWT, jwtVerify } from "jose"

export const VILLAGE_COOKIE_NAME = "village_access"
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

function encoder(secret: string) {
  return new TextEncoder().encode(secret)
}

// Short fingerprint of the current password. Bakes into the JWT so rotating
// VILLAGE_PASSWORD invalidates every existing cookie automatically. Uses
// Web Crypto so it runs in both the edge middleware and node route handlers.
async function passwordFingerprint(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hex.slice(0, 10)
}

function requireEnv(): { password: string; secret: string } {
  const password = process.env.VILLAGE_PASSWORD
  const secret = process.env.SESSION_JWT_SECRET
  if (!password || !secret) {
    throw new Error("VILLAGE_PASSWORD or SESSION_JWT_SECRET is not set")
  }
  return { password, secret }
}

export async function issueVillageCookie(): Promise<string> {
  const { password, secret } = requireEnv()
  const fp = await passwordFingerprint(password)
  const token = await new SignJWT({ v: fp })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_TTL_SECONDS}s`)
    .sign(encoder(secret))
  return token
}

export async function verifyVillageCookie(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const { password, secret } = requireEnv()
  try {
    const { payload } = await jwtVerify(token, encoder(secret))
    const fp = await passwordFingerprint(password)
    return payload.v === fp
  } catch {
    return false
  }
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const { password } = requireEnv()
  const a = await passwordFingerprint(candidate)
  const b = await passwordFingerprint(password)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const villageCookieMaxAge = COOKIE_TTL_SECONDS
