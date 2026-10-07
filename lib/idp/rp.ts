// What a relying party must check when it signs someone in through the one OSC sign-in (contract §1–§2; SPEC §27
// P1 v2 #11). The rehearsal driver (scripts/rehearse_idp.ts) runs these against staging; the tests sign tokens with a
// local key. Any surface may copy this file: it's the contract, as code. No database, no Next.
import { createHash, randomBytes } from "crypto"
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from "jose"

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** PKCE (S256 only, contract §1): a fresh verifier and its challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32))
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) }
}

/** A fresh, unguessable value for `state` and `nonce` (both REQUIRED, contract §1). */
export const randomToken = () => b64url(randomBytes(24))

/** The authorization request a surface sends (code + PKCE; `openid email profile`; the optional parameters of §1). */
export function authorizeUrl(input: {
  endpoint: string
  clientId: string
  redirectUri: string
  state: string
  nonce: string
  challenge: string
  loginHint?: string
  prompt?: "none" | "login"
  maxAge?: number
  codeFirst?: boolean
}): string {
  const u = new URL(input.endpoint)
  const q = u.searchParams
  q.set("response_type", "code")
  q.set("client_id", input.clientId)
  q.set("redirect_uri", input.redirectUri)
  q.set("scope", "openid email profile")
  q.set("state", input.state)
  q.set("nonce", input.nonce)
  q.set("code_challenge", input.challenge)
  q.set("code_challenge_method", "S256")
  if (input.loginHint) q.set("login_hint", input.loginHint)
  if (input.prompt) q.set("prompt", input.prompt)
  if (input.maxAge !== undefined) q.set("max_age", String(input.maxAge))
  if (input.codeFirst) q.set("osc_code_first", "1")
  return u.toString()
}

/** What's wrong with the discovery document against the contract (empty = fine). */
export function discoveryProblems(doc: Record<string, unknown>, issuer: string): string[] {
  const out: string[] = []
  const list = (k: string) => (Array.isArray(doc[k]) ? (doc[k] as unknown[]).map(String) : [])
  if (doc.issuer !== issuer) out.push(`issuer is ${String(doc.issuer)}, not ${issuer}`)
  for (const k of ["authorization_endpoint", "token_endpoint", "jwks_uri", "end_session_endpoint"]) {
    const v = doc[k]
    if (typeof v !== "string" || !v.startsWith(`${issuer}/`)) out.push(`${k} isn't on the issuer: ${String(v)}`)
  }
  if (doc.userinfo_endpoint !== undefined) out.push("there is a userinfo endpoint (the contract has none)")
  const rt = list("response_types_supported")
  if (rt.length !== 1 || rt[0] !== "code") out.push(`response types ${JSON.stringify(rt)}: code only`)
  if (!list("code_challenge_methods_supported").includes("S256")) out.push("no S256 PKCE")
  if (list("code_challenge_methods_supported").includes("plain")) out.push("plain PKCE is offered")
  const algs = list("id_token_signing_alg_values_supported")
  if (algs.length !== 1 || algs[0] !== "ES256") out.push(`ID token algs ${JSON.stringify(algs)}: ES256 only`)
  if (!list("token_endpoint_auth_methods_supported").includes("client_secret_basic")) out.push("no client_secret_basic")
  if (list("grant_types_supported").some((g) => g === "implicit" || g === "refresh_token")) out.push("implicit or refresh grants are offered")
  return out
}

/** What's wrong with the published key set (empty = fine): every key ES256 on P-256, with a `kid`, and PUBLIC only. */
export function jwksProblems(jwks: JSONWebKeySet): string[] {
  const out: string[] = []
  if (!Array.isArray(jwks.keys) || !jwks.keys.length) return ["no keys"]
  for (const k of jwks.keys) {
    const key = k as Record<string, unknown>
    if (key.d !== undefined) out.push(`key ${String(key.kid)} publishes its PRIVATE part`)
    if (!key.kid) out.push("a key has no kid")
    if (key.kty !== "EC" || key.crv !== "P-256") out.push(`key ${String(key.kid)} isn't EC P-256`)
    if (key.alg !== undefined && key.alg !== "ES256") out.push(`key ${String(key.kid)} is ${String(key.alg)}`)
  }
  return out
}

export type OscAdminClaim = { role: "owner" | "deputy"; surfaces: string[]; scope: "all" | string[]; until: string }
export type IdClaims = JWTPayload & {
  sub: string
  email: string
  email_verified: true
  name: string
  sid: string
  auth_time: number
  amr: string[]
  osc_admin?: OscAdminClaim
}

const ADMIN_SECONDS = 12 * 3600

/**
 * Verify an ID token exactly as contract §2 says: ES256 against the JWKS (kid must be in it), `iss`, `aud`, `exp` and
 * `iat` with 60 s of skew, the `nonce` we sent; then every claim's shape, `amr` link-or-code, and `osc_admin` only
 * inside the 12 hours from `auth_time`.
 */
export async function checkIdToken(
  token: string,
  expect: { jwks: JSONWebKeySet; issuer: string; audience: string; nonce: string; now?: Date },
): Promise<{ ok: true; claims: IdClaims } | { ok: false; why: string }> {
  let payload: JWTPayload
  try {
    const r = await jwtVerify(token, createLocalJWKSet(expect.jwks), {
      algorithms: ["ES256"],
      issuer: expect.issuer,
      audience: expect.audience,
      clockTolerance: 60,
      currentDate: expect.now,
      requiredClaims: ["iat", "exp", "sub"],
    })
    payload = r.payload
  } catch (err) {
    return { ok: false, why: `signature or registered claims: ${(err as Error).message}` }
  }
  const p = payload as Record<string, unknown>
  const now = Math.floor((expect.now ?? new Date()).getTime() / 1000)
  if (typeof p.iat === "number" && p.iat > now + 60) return { ok: false, why: "iat is in the future" }
  if (p.nonce !== expect.nonce) return { ok: false, why: "nonce isn't the one we sent" }
  if (typeof p.sub !== "string" || !p.sub) return { ok: false, why: "no sub" }
  if (typeof p.email !== "string" || p.email !== p.email.toLowerCase() || !p.email.includes("@")) return { ok: false, why: "email missing or not lowercase" }
  if (p.email_verified !== true) return { ok: false, why: "email_verified isn't true" }
  if (typeof p.name !== "string" || !p.name.trim()) return { ok: false, why: "no name" }
  if (typeof p.sid !== "string" || !p.sid) return { ok: false, why: "no sid" }
  if (typeof p.auth_time !== "number" || p.auth_time > now + 60) return { ok: false, why: "auth_time missing or in the future" }
  if (!Array.isArray(p.amr) || p.amr.length !== 1 || (p.amr[0] !== "link" && p.amr[0] !== "code")) return { ok: false, why: "amr isn't [link] or [code]" }
  if (p.osc_admin !== undefined) {
    const a = p.osc_admin as Record<string, unknown>
    const shapeOk =
      (a.role === "owner" || a.role === "deputy") &&
      Array.isArray(a.surfaces) &&
      (a.scope === "all" || (Array.isArray(a.scope) && a.scope.every((j) => typeof j === "string" && /^\d{2}-\d{3}$/.test(j)))) &&
      typeof a.until === "string" &&
      !Number.isNaN(Date.parse(a.until))
    if (!shapeOk) return { ok: false, why: "osc_admin has the wrong shape" }
    if (now - (p.auth_time as number) >= ADMIN_SECONDS) return { ok: false, why: "osc_admin on a sign-in 12 hours old or more" }
    if (Date.parse(a.until as string) / 1000 > (p.auth_time as number) + ADMIN_SECONDS + 1) return { ok: false, why: "osc_admin outlives the 12 hours" }
  }
  return { ok: true, claims: p as unknown as IdClaims }
}
