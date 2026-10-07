// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/idp/rp.test.ts
// The relying party's checks (contract §1–§2), against tokens signed here with a throwaway ES256 key.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "crypto"
import { SignJWT, exportJWK, generateKeyPair, type JSONWebKeySet } from "jose"
import { authorizeUrl, checkIdToken, discoveryProblems, jwksProblems, pkcePair } from "./rp"

const ISS = "https://osc-website-staging.up.railway.app"
const NOW = new Date("2026-10-07T06:00:00Z")
const sec = (d: Date) => Math.floor(d.getTime() / 1000)

async function keys() {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true })
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" }
  return { privateKey, jwks: { keys: [jwk] } as JSONWebKeySet, jwk }
}

async function idToken(privateKey: CryptoKey, claims: Record<string, unknown>, over: { alg?: string; kid?: string; iat?: number; exp?: number; aud?: string; iss?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: over.alg ?? "ES256", kid: over.kid ?? "k1" })
    .setIssuer(over.iss ?? ISS)
    .setAudience(over.aud ?? "test")
    .setIssuedAt(over.iat ?? sec(NOW))
    .setExpirationTime(over.exp ?? sec(NOW) + 600)
    .sign(privateKey)
}

const good = {
  sub: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b",
  email: "sam+rehearsal@oliverstreetcreative.com",
  email_verified: true,
  name: "Sam Rehearsal",
  sid: "sid-1",
  auth_time: sec(NOW) - 3600,
  amr: ["code"],
  nonce: "n-1",
}

test("PKCE is S256 of the verifier; the authorize request carries everything the contract requires", () => {
  const { verifier, challenge } = pkcePair()
  assert.equal(verifier.length, 43)
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"))
  const u = new URL(authorizeUrl({ endpoint: `${ISS}/id/auth`, clientId: "test", redirectUri: "http://127.0.0.1:8765/auth/oidc/callback", state: "s", nonce: "n", challenge, loginHint: "Kris@Example.com", prompt: "none", maxAge: 0, codeFirst: true }))
  const q = u.searchParams
  assert.equal(q.get("response_type"), "code")
  assert.equal(q.get("scope"), "openid email profile")
  assert.equal(q.get("code_challenge_method"), "S256")
  assert.equal(q.get("state"), "s")
  assert.equal(q.get("nonce"), "n")
  assert.equal(q.get("login_hint"), "Kris@Example.com")
  assert.equal(q.get("prompt"), "none")
  assert.equal(q.get("max_age"), "0")
  assert.equal(q.get("osc_code_first"), "1")
})

test("discovery: issuer-hosted endpoints, code + S256 only, ES256 only, no userinfo", () => {
  const doc = {
    issuer: ISS,
    authorization_endpoint: `${ISS}/id/auth`,
    token_endpoint: `${ISS}/id/token`,
    jwks_uri: `${ISS}/id/jwks`,
    end_session_endpoint: `${ISS}/id/session/end`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    id_token_signing_alg_values_supported: ["ES256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    grant_types_supported: ["authorization_code"],
  }
  assert.deepEqual(discoveryProblems(doc, ISS), [])
  assert.equal(discoveryProblems({ ...doc, userinfo_endpoint: `${ISS}/id/me` }, ISS).length, 1)
  assert.equal(discoveryProblems({ ...doc, response_types_supported: ["code", "id_token"] }, ISS).length, 1)
  assert.equal(discoveryProblems({ ...doc, code_challenge_methods_supported: ["S256", "plain"] }, ISS).length, 1)
  assert.equal(discoveryProblems({ ...doc, token_endpoint: "https://evil.example/token" }, ISS).length, 1)
  assert.equal(discoveryProblems({ ...doc, grant_types_supported: ["authorization_code", "refresh_token"] }, ISS).length, 1)
  assert.ok(discoveryProblems({ ...doc, issuer: "https://oliverstreetcreative.com" }, ISS).length >= 1)
})

test("the key set: public EC P-256 keys with a kid, and never a private part", async () => {
  const { jwks, privateKey } = await keys()
  assert.deepEqual(jwksProblems(jwks), [])
  const leaked = { keys: [{ ...(await exportJWK(privateKey)), kid: "k1", alg: "ES256" }] } as JSONWebKeySet
  assert.ok(jwksProblems(leaked).some((p) => p.includes("PRIVATE")))
  assert.deepEqual(jwksProblems({ keys: [] }), ["no keys"])
})

test("an ID token passes only as the contract says", async () => {
  const { privateKey, jwks } = await keys()
  const expect = { jwks, issuer: ISS, audience: "test", nonce: "n-1", now: NOW }
  const ok = await checkIdToken(await idToken(privateKey, good), expect)
  assert.ok(ok.ok, ok.ok ? "" : ok.why)
  // Each of these must fail.
  const fails: [string, Promise<string>][] = [
    ["another audience", idToken(privateKey, good, { aud: "sign" })],
    ["another issuer", idToken(privateKey, good, { iss: "https://oliverstreetcreative.com" })],
    ["expired", idToken(privateKey, good, { iat: sec(NOW) - 1200, exp: sec(NOW) - 120 })],
    ["another nonce", idToken(privateKey, { ...good, nonce: "n-2" })],
    ["an unknown kid", idToken(privateKey, good, { kid: "k9" })],
    ["uppercase email", idToken(privateKey, { ...good, email: "Sam@OliverStreetCreative.com" })],
    ["unverified email", idToken(privateKey, { ...good, email_verified: false })],
    ["no sid", idToken(privateKey, { ...good, sid: undefined })],
    ["amr invite", idToken(privateKey, { ...good, amr: ["invite"] })],
    ["auth_time in the future", idToken(privateKey, { ...good, auth_time: sec(NOW) + 3600 })],
    ["osc_admin 12 hours after the sign-in", idToken(privateKey, { ...good, auth_time: sec(NOW) - 12 * 3600, osc_admin: { role: "owner", surfaces: ["sign"], scope: "all", until: new Date(NOW.getTime() + 3600_000).toISOString() } })],
    ["osc_admin that outlives the 12 hours", idToken(privateKey, { ...good, osc_admin: { role: "deputy", surfaces: ["sign"], scope: ["26-012"], until: new Date((good.auth_time + 13 * 3600) * 1000).toISOString() } })],
    ["osc_admin with a bad scope", idToken(privateKey, { ...good, osc_admin: { role: "deputy", surfaces: ["sign"], scope: ["Torres"], until: new Date(NOW.getTime() + 3600_000).toISOString() } })],
  ]
  for (const [what, tok] of fails) {
    const r = await checkIdToken(await tok, expect)
    assert.equal(r.ok, false, what)
  }
  // A token signed by a different key (not in our JWKS, same kid) fails too.
  const other = await keys()
  assert.equal((await checkIdToken(await idToken(other.privateKey, good), expect)).ok, false)
  // A deputy inside the 12 hours passes.
  const deputy = await checkIdToken(
    await idToken(privateKey, { ...good, osc_admin: { role: "deputy", surfaces: ["sign"], scope: ["26-012"], until: new Date((good.auth_time + 12 * 3600) * 1000).toISOString() } }),
    expect,
  )
  assert.ok(deputy.ok, deputy.ok ? "" : deputy.why)
})
