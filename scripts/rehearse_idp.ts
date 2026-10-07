// Rehearse the one OSC sign-in (client-website SPEC §27 P1 v2 #11; contracts/osc-signin-contract-v1.md) against
// STAGING as the test relying party, at the protocol level, with a real sign-in. It is P1a part 2's acceptance test:
// until the provider is mounted, step 1 fails and so does the run.
//
//   node --conditions=import --import tsx scripts/rehearse_idp.ts <base-url> <email>:<6-digit code> [report.md]
//
// Sign-in (SPEC §27 P0 v2): ask for a link as the rehearsal person, read the CODE from that email, pass email:code
// (a link signs in only the browser that asked for it, so a driver uses the code). The code is one-time and short.
// The test client's secret comes from the environment (IDP_CLIENT_TEST_SECRET) or the Keychain (service
// "osc-idp-client-test", account "staging"): never argv, never disk. Sessions live only in memory.
//
// What it proves, in order:
//  1. discovery and the key set are the contract's (issuer-hosted; code + S256 only; ES256 only; no userinfo; public
//     keys only);
//  2. an authorization with nobody signed in goes to the bridge, which offers the front door;
//  3. a sign-in at the front door (the code), then the bridge, finishes it: a code comes back with OUR state;
//  4. the code exchanges (HTTP Basic + PKCE) for an ID token that passes every contract check: this email, amr
//     [code], no refresh token;
//  5. session status for its sid: active, the same sub;
//  6. prompt=none signs in silently AND keeps auth_time (continuing never resets it: review MUST-FIX 3);
//  7. a login_hint for someone else gets the choose screen, never a silent sign-in;
//  8. after signing out at the apex, session status says inactive and prompt=none gets login_required.
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import type { JSONWebKeySet } from "jose"
import { authorizeUrl, checkIdToken, discoveryProblems, jwksProblems, pkcePair, randomToken, type IdClaims } from "../lib/idp/rp"

const [baseArg, token, reportPath] = process.argv.slice(2)
if (!baseArg || !token || !token.includes(":")) {
  console.error("usage: rehearse_idp.ts <base-url> <email>:<6-digit code> [report.md]")
  process.exit(2)
}
const BASE = baseArg.replace(/\/$/, "")
const [EMAIL, CODE] = [token.slice(0, token.indexOf(":")).trim().toLowerCase(), token.slice(token.indexOf(":") + 1).trim()]
const CLIENT = "test"
const REDIRECT = "http://127.0.0.1:8765/auth/oidc/callback" // registered for `test` on staging (lib/idp/clients.ts)
const SOMEONE_ELSE = "sam+rehearsal-signing@oliverstreetcreative.com"

const log: string[] = []
let failures = 0
function step(ok: boolean, what: string, detail = ""): boolean {
  const line = `${ok ? "PASS" : "FAIL"} ${what}${detail ? ` — ${detail}` : ""}`
  log.push(line)
  console.log(line)
  if (!ok) failures++
  return ok
}
function finish(): never {
  const summary = `${log.length - failures}/${log.length} PASS`
  console.log(summary)
  if (reportPath) {
    writeFileSync(reportPath, `# One sign-in rehearsal on staging 🤖\n\n${BASE} · run by the client-website worker\n\n${log.map((l) => `- ${l}`).join("\n")}\n\n**${summary}**\n`)
  }
  process.exit(failures ? 1 : 0)
}

function clientSecret(): string {
  const env = process.env.IDP_CLIENT_TEST_SECRET?.trim()
  if (env) return env
  try {
    return execFileSync("security", ["find-generic-password", "-s", "osc-idp-client-test", "-a", "staging", "-w"], { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

// One browser: a cookie jar for the site, redirects followed by hand (so every hop is seen).
const jar = new Map<string, string>()
async function call(url: string, init: { method?: string; form?: Record<string, string>; json?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Origin: BASE, Referer: `${BASE}/login`, ...(init.headers ?? {}) }
  // A header given as "" is dropped: server-to-server calls (token, session status) send no Origin or Referer at all.
  for (const [k, v] of Object.entries(headers)) if (v === "") delete headers[k]
  const target = new URL(url, BASE)
  // The browser's cookies go only with browser calls: a call with client credentials is server to server.
  if (target.origin === new URL(BASE).origin && jar.size && !headers.Authorization) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
  let body: string | undefined
  if (init.form) {
    body = new URLSearchParams(init.form).toString()
    headers["Content-Type"] = "application/x-www-form-urlencoded"
  } else if (init.json !== undefined) {
    body = JSON.stringify(init.json)
    headers["Content-Type"] = "application/json"
  }
  const res = await fetch(target, { method: init.method ?? (body ? "POST" : "GET"), headers, body, redirect: "manual" })
  if (target.origin === new URL(BASE).origin && !headers.Authorization) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      const name = pair.slice(0, i).trim()
      const value = pair.slice(i + 1).trim()
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || value === "") jar.delete(name)
      else jar.set(name, value)
    }
  }
  return { status: res.status, location: res.headers.get("location"), text: await res.text(), headers: res.headers }
}

/** Follow redirects on the site until one leaves for our callback (returned) or a page answers (returned). */
async function follow(url: string, hops = 10): Promise<{ callback?: URL; page?: { url: string; status: number; text: string } }> {
  let next = url
  for (let i = 0; i < hops; i++) {
    const r = await call(next)
    if (r.status >= 300 && r.status < 400 && r.location) {
      const loc = new URL(r.location, next)
      if (loc.toString().startsWith(REDIRECT)) return { callback: loc }
      next = loc.toString()
      continue
    }
    return { page: { url: next, status: r.status, text: r.text } }
  }
  return { page: { url: next, status: 0, text: "too many redirects" } }
}

async function main() {
  const secret = clientSecret()
  if (!step(secret.length >= 32, "the test client's secret is at hand (env or Keychain, never argv)")) finish()
  const basic = `Basic ${Buffer.from(`${encodeURIComponent(CLIENT)}:${encodeURIComponent(secret)}`).toString("base64")}`

  // 1. Discovery and keys.
  const d = await call(`${BASE}/.well-known/openid-configuration`)
  let doc: Record<string, unknown> = {}
  try {
    doc = JSON.parse(d.text)
  } catch {
    /* not JSON */
  }
  const problems = d.status === 200 ? discoveryProblems(doc, BASE) : [`HTTP ${d.status}`]
  if (!step(!problems.length, "discovery is the contract's", problems.join("; "))) finish()
  const k = await call(String(doc.jwks_uri))
  const jwks = (() => {
    try {
      return JSON.parse(k.text) as JSONWebKeySet
    } catch {
      return { keys: [] } as JSONWebKeySet
    }
  })()
  const kp = jwksProblems(jwks)
  step(k.status === 200 && !kp.length, "the key set is public ES256 keys only", kp.join("; "))

  // 2. Nobody signed in: the authorization lands on the bridge, which offers the front door.
  const pk = pkcePair()
  const state = randomToken()
  const nonce = randomToken()
  const first = await follow(authorizeUrl({ endpoint: String(doc.authorization_endpoint), clientId: CLIENT, redirectUri: REDIRECT, state, nonce, challenge: pk.challenge }))
  const bridge = first.page
  const uid = bridge?.url.match(/\/id\/sign-in\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  if (!step(!!uid && bridge?.status === 200, "an authorization with nobody signed in goes to the bridge", bridge ? `${bridge.status} ${bridge.url}` : "it came straight back")) finish()
  step(/sign-in link|6-digit code|Email me/i.test(bridge!.text), "the bridge offers the front door (a link or the code)")

  // 3. Sign in at the front door with the code, then the bridge finishes the authorization.
  const signin = await call(`${BASE}/api/auth/code`, { json: { email: EMAIL, code: CODE } })
  if (!step(signin.status === 200 && [...jar.keys()].some((n) => n === "__Host-osc_session" || n === "osc_session"), "sign in at the front door with the code", String(signin.status))) finish()
  const done = await follow(`${BASE}/id/sign-in/${uid}`)
  const cb = done.callback
  if (!step(!!cb?.searchParams.get("code") && cb.searchParams.get("state") === state, "the bridge finishes it: a code, with our state", cb ? cb.search : `${done.page?.status} ${done.page?.url}`)) finish()

  // 4. Exchange the code: Basic + PKCE; the ID token passes every contract check.
  async function exchange(code: string, verifier: string) {
    const t = await call(String(doc.token_endpoint), {
      form: { grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier },
      headers: { Authorization: basic, Origin: "", Referer: "" },
    })
    try {
      return { status: t.status, body: JSON.parse(t.text) as Record<string, unknown> }
    } catch {
      return { status: t.status, body: {} as Record<string, unknown> }
    }
  }
  const tok = await exchange(cb!.searchParams.get("code")!, pk.verifier)
  step(tok.status === 200 && typeof tok.body.id_token === "string", "the code exchanges for an ID token", String(tok.status))
  step(tok.body.refresh_token === undefined, "no refresh token")
  const checked = await checkIdToken(String(tok.body.id_token ?? ""), { jwks, issuer: BASE, audience: CLIENT, nonce })
  if (!step(checked.ok, "the ID token passes every contract check", checked.ok ? "" : checked.why)) finish()
  const claims = (checked as { ok: true; claims: IdClaims }).claims
  step(claims.email === EMAIL && claims.amr[0] === "code", "it's this person, signed in by code", `${claims.email} ${claims.amr.join(",")}`)
  const reused = await exchange(cb!.searchParams.get("code")!, pk.verifier)
  step(reused.status >= 400, "the same code can't be used twice", String(reused.status))

  // 5. Session status for its sid.
  const status = async (sid: string) => {
    const s = await call(`${BASE}/id/session-status`, { json: { sid }, headers: { Authorization: basic, Origin: "", Referer: "" } })
    try {
      return { status: s.status, body: JSON.parse(s.text) as { active?: boolean; sub?: string | null; osc_admin?: unknown } }
    } catch {
      return { status: s.status, body: {} as { active?: boolean; sub?: string | null } }
    }
  }
  const st = await status(claims.sid)
  step(st.status === 200 && st.body.active === true && st.body.sub === claims.sub, "session status: active, the same sub", JSON.stringify(st.body))
  const wrong = await call(`${BASE}/id/session-status`, { json: { sid: claims.sid }, headers: { Authorization: "Basic dGVzdDpub3BlLW5vcGUtbm9wZS1ub3BlLW5vcGUtbm9wZS1ub3Bl", Origin: "", Referer: "" } })
  step(wrong.status === 401, "session status refuses a wrong secret", String(wrong.status))

  // 6. prompt=none: silent, and auth_time is the ORIGINAL sign-in's.
  const pk2 = pkcePair()
  const state2 = randomToken()
  const nonce2 = randomToken()
  const silent = await follow(authorizeUrl({ endpoint: String(doc.authorization_endpoint), clientId: CLIENT, redirectUri: REDIRECT, state: state2, nonce: nonce2, challenge: pk2.challenge, prompt: "none" }))
  const code2 = silent.callback?.searchParams.get("code")
  step(!!code2 && silent.callback?.searchParams.get("state") === state2, "prompt=none signs in silently", silent.callback?.search ?? `${silent.page?.status} ${silent.page?.url}`)
  if (code2) {
    const tok2 = await exchange(code2, pk2.verifier)
    const c2 = await checkIdToken(String(tok2.body.id_token ?? ""), { jwks, issuer: BASE, audience: CLIENT, nonce: nonce2 })
    step(c2.ok && c2.claims.auth_time === claims.auth_time && c2.claims.sub === claims.sub, "continuing keeps auth_time (the original sign-in's)",
      c2.ok ? `${c2.claims.auth_time} vs ${claims.auth_time}` : c2.why)
  }

  // 7. A login_hint for someone else: the choose screen, never a silent sign-in.
  const pk3 = pkcePair()
  const hinted = await follow(authorizeUrl({ endpoint: String(doc.authorization_endpoint), clientId: CLIENT, redirectUri: REDIRECT, state: randomToken(), nonce: randomToken(), challenge: pk3.challenge, loginHint: SOMEONE_ELSE }))
  step(!hinted.callback && !!hinted.page && /Continue as/i.test(hinted.page.text) && /someone else/i.test(hinted.page.text),
    "a login_hint for someone else asks (\"Continue as …, or sign in as someone else?\")", hinted.callback ? "it signed in silently" : `${hinted.page?.status}`)

  // 8. Sign out at the apex: status inactive, and prompt=none gets login_required.
  const out = await call(`${BASE}/client/signout`, { method: "POST", form: {} })
  step(out.status === 303 || out.status === 200, "sign out at the apex", String(out.status))
  const st2 = await status(claims.sid)
  step(st2.status === 200 && st2.body.active === false && st2.body.sub === null, "session status after sign-out: inactive, nothing else said", JSON.stringify(st2.body))
  const pk4 = pkcePair()
  const after = await follow(authorizeUrl({ endpoint: String(doc.authorization_endpoint), clientId: CLIENT, redirectUri: REDIRECT, state: randomToken(), nonce: randomToken(), challenge: pk4.challenge, prompt: "none" }))
  step(after.callback?.searchParams.get("error") === "login_required", "prompt=none after sign-out: login_required", after.callback?.search ?? `${after.page?.status} ${after.page?.url}`)
  finish()
}

main().catch((err) => {
  step(false, "the rehearsal crashed", String((err as Error)?.message ?? err).slice(0, 200))
  finish()
})
