import { test } from "node:test"
import assert from "node:assert/strict"
import { requestLink, verifyLink, verifyCode, type AccessLink, type MagicDeps } from "./magic"
import { GATE_COOKIE_SHARED, requestHasPass, gateCookieExpirations, gateExemption, stagingCookieDomain, stagingEmail, passCookie, passValid, makePass } from "./gate"
import { gateForm } from "./form"
import { sameOrigin } from "../support/http"
const KEY = "test-only-staging-signing-key-123456789"
const ORIGIN = "https://staging.oliverstreetcreative.com"
const DEVICE = "test-device"
function fixture() {
  let now = 1800000000000
  const rows: AccessLink[] = []
  const sent: { email: string; link: string; code: string }[] = []
  let allow = true
  let reads = 0
  let failures = 0
  const deps: MagicDeps = {
    staging: true, key: KEY, now: () => now,
    store: {
      create: async (row) => { rows.push(row) },
      byToken: async (hash) => { reads++; return rows.find((r) => r.token_hash === hash) ?? null },
      byEmail: async (email, origin) => { reads++; return rows.filter((r) => r.email === email && r.origin === origin).at(-1) ?? null },
      consume: async (id, at) => {
        const row = rows.find((r) => r.id === id)!
        if (row.consumed_at || row.expires_at <= at || row.code_tries >= 5) return false
        row.consumed_at = at; return true
      },
      failCode: async (id, at) => { const r = rows.find((r) => r.id === id)!; if (!r.consumed_at && r.expires_at > at && r.code_tries < 5) r.code_tries++ },
    },
    allowLink: async () => allow,
    allowCode: async (_email, tries) => allow && tries < 5,
    recordCodeFailure: async () => { failures++ },
    send: async (email, link, code) => { sent.push({ email, link, code }) },
  }
  return { deps, rows, sent, token: () => new URL(sent.at(-1)!.link).searchParams.get("token")!,
    reads: () => reads, failures: () => failures, advance: (ms: number) => { now += ms }, cap: () => { allow = false } }
}

test("corporate domain is exact; mixed case/plus addresses normalize", () => {
  assert.equal(stagingEmail("  Sam+stage@OliverStreetCreative.com "), "sam+stage@oliverstreetcreative.com")
  for (const bad of ["@oliverstreetcreative.com", "x@@oliverstreetcreative.com", "x@sub.oliverstreetcreative.com", "x@oliverstreetcreative.com.evil", "x@eviloliverstreetcreative.com", "Sam <sam@oliverstreetcreative.com>", ".x@oliverstreetcreative.com", "x..y@oliverstreetcreative.com", "x\n@oliverstreetcreative.com", "x@oliverstreetcreаtive.com"]) assert.equal(stagingEmail(bad), null, bad)
})
test("any OSC address can request without a Person; only hashes stored", async () => {
  const f = fixture()
  assert.equal(await requestLink("new-hire@oliverstreetcreative.com", "/work?x=1", ORIGIN, DEVICE, f.deps), "sent")
  assert.equal(f.sent.length, 1)
  assert.equal(f.rows[0].email, "new-hire@oliverstreetcreative.com")
  assert.equal(f.rows[0].next_path, "/work?x=1")
  assert.match(f.token(), /^[0-9a-f]{64}$/)
  assert.notEqual(f.rows[0].token_hash, f.token())
  assert.notEqual(f.rows[0].code_hash, f.sent[0].code)
  assert.equal(f.rows[0].expires_at.getTime() - f.rows[0].created_at.getTime(), 900000)
})
test("production, bad domains, missing signing key, rate cap send nothing", async () => {
  for (const off of ["production", "domain", "key", "cap"]) {
    const f = fixture()
    if (off === "production") f.deps.staging = false
    if (off === "key") f.deps.key = ""
    if (off === "cap") f.cap()
    await requestLink(off === "domain" ? "client@example.com" : "x@oliverstreetcreative.com", "/", ORIGIN, DEVICE, f.deps)
    assert.equal(f.sent.length, 0); assert.equal(f.rows.length, 0)
  }
})
test("link verification spends once, keeps destination, never mints a portal session", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "/faq", ORIGIN, DEVICE, f.deps)
  assert.deepEqual(await verifyLink(f.token(), ORIGIN, DEVICE, f.deps), { ok: true, next: "/faq" })
  assert.equal((await verifyLink(f.token(), ORIGIN, DEVICE, f.deps)).ok, false)
  assert.equal((await verifyCode("sam@oliverstreetcreative.com", f.sent[0].code, ORIGIN, f.deps)).ok, false)
})
test("scanner/other device does not spend link; code works on another device", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "/", ORIGIN, DEVICE, f.deps)
  for (const device of [null, "different"]) assert.deepEqual(await verifyLink(f.token(), ORIGIN, device, f.deps), { ok: false, why: "code" })
  assert.equal(f.rows[0].consumed_at, null)
  const code = f.sent[0].code
  assert.equal((await verifyCode("SAM@oliverstreetcreative.com", code.slice(0,3)+" "+code.slice(3), ORIGIN, f.deps)).ok, true)
})
test("host-bound, expiry boundary, malformed token, wrong domain all fail", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "/", ORIGIN, DEVICE, f.deps)
  assert.equal((await verifyLink(f.token(), "https://client.staging.oliverstreetcreative.com", DEVICE, f.deps)).ok, false)
  assert.equal((await verifyLink("junk", ORIGIN, DEVICE, f.deps)).ok, false)
  assert.equal((await verifyCode("client@example.com", f.sent[0].code, ORIGIN, f.deps)).ok, false)
  f.advance(900000)
  assert.equal((await verifyLink(f.token(), ORIGIN, DEVICE, f.deps)).ok, false)
  assert.equal((await verifyCode("sam@oliverstreetcreative.com", f.sent[0].code, ORIGIN, f.deps)).ok, false)
})
test("parallel link/code redemption has exactly one winner", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "/", ORIGIN, DEVICE, f.deps)
  const results = await Promise.all([verifyLink(f.token(), ORIGIN, DEVICE, f.deps), verifyCode("sam@oliverstreetcreative.com", f.sent[0].code, ORIGIN, f.deps)])
  assert.equal(results.filter((r) => r.ok).length, 1)
})
test("five wrong codes exhaust the invite, including parallel guesses", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "/", ORIGIN, DEVICE, f.deps)
  const wrong = f.sent[0].code === "000000" ? "111111" : "000000"
  await Promise.all(Array.from({length:10}, () => verifyCode("sam@oliverstreetcreative.com", wrong, ORIGIN, f.deps)))
  assert.equal(f.rows[0].code_tries, 5)
  assert.equal((await verifyCode("sam@oliverstreetcreative.com", f.sent[0].code, ORIGIN, f.deps)).ok, false)
  assert.equal((await verifyLink(f.token(), ORIGIN, DEVICE, f.deps)).ok, false)
})
test("verified redirect is sanitized; even a changed stored path cannot escape", async () => {
  const f = fixture(); await requestLink("sam@oliverstreetcreative.com", "//evil.example", ORIGIN, DEVICE, f.deps)
  assert.equal(f.rows[0].next_path, "/")
  f.rows[0].next_path = "/\\evil.example"
  assert.deepEqual(await verifyLink(f.token(), ORIGIN, DEVICE, f.deps), {ok:true,next:"/"})
})
test("gate exceptions open only the specific email endpoints/methods", () => {
  for (const [path, method] of [["/staging-gate/magic","GET"],["/staging-gate/verify","POST"],["/staging-gate/code","POST"],["/staging-gate/signout","POST"]]) assert.equal(gateExemption(path,method),"gate")
  for (const [path, method] of [["/staging-gate/verify","GET"],["/staging-gate/code","GET"],["/staging-gate/magic","POST"],["/staging-gate/anything","GET"],["/api/auth/request-magic-link","POST"]]) assert.equal(gateExemption(path,method),null)
})
test("cookie sharing is restricted to staging, never the production parent", async () => {
  for (const host of ["staging.oliverstreetcreative.com","crew.staging.oliverstreetcreative.com","client.staging.oliverstreetcreative.com","login.staging.oliverstreetcreative.com"]) assert.equal(stagingCookieDomain(host),".staging.oliverstreetcreative.com")
  for (const host of ["oliverstreetcreative.com","login.oliverstreetcreative.com","evil-staging.oliverstreetcreative.com","staging.oliverstreetcreative.com.evil","osc-website-staging.up.railway.app","localhost"]) assert.equal(stagingCookieDomain(host),undefined)
  const cookie = passCookie(true, 60, "crew.staging.oliverstreetcreative.com")
  assert.equal(cookie.name,GATE_COOKIE_SHARED); assert.equal(cookie.options.domain,".staging.oliverstreetcreative.com")
  assert.equal(cookie.options.httpOnly,true); assert.equal(cookie.options.secure,true)
  assert.equal((await passValid((await makePass(KEY,1800003600)).replace("v2.","v1."),KEY,1800000000)),false)
})
test("native forms enforce streaming cap and same-origin", async () => {
  const form = (body:string, headers:Record<string,string>={}) => new Request(ORIGIN+"/staging-gate/enter",{method:"POST",body,headers:{"content-type":"application/x-www-form-urlencoded",...headers}})
  assert.equal((await gateForm(form("email=x%40oliverstreetcreative.com")))?.get("email"),"x@oliverstreetcreative.com")
  assert.equal(await gateForm(form("x="+"a".repeat(4000))),null)
  assert.equal(await gateForm(form("x=1",{"content-length":"5000"})),null)
  assert.equal(sameOrigin(form("x=1", {host:"staging.oliverstreetcreative.com",origin:ORIGIN})),true)
  assert.equal(sameOrigin(form("x=1", {host:"staging.oliverstreetcreative.com",origin:"https://evil.example"})),false)
})

test("signout clears host and shared cookies without collapsing UI duplicates", () => {
  const expired = gateCookieExpirations("staging.oliverstreetcreative.com", true)
  assert.equal(expired.length,5)
  assert.equal(expired.filter((v) => v.startsWith("osc_gate_ui=")).length,2)
  assert.equal(expired.filter((v) => v.includes("Domain=")).length,2)
  assert.ok(expired.every((v) => v.includes("Max-Age=0")))
  assert.ok(expired.every((v) => !v.includes("Domain=.oliverstreetcreative.com")))
  assert.equal(gateCookieExpirations("localhost", false).some((v)=>v.includes("Domain=")),false)
})

test("shared grant works only on staging hosts, old password cookies never work", async () => {
  process.env.SESSION_JWT_SECRET = KEY
  try {
    const now = 1800000000
    const pass = await makePass(KEY,now+3600)
    const headers = (host: string, value: string) => new Headers({host,cookie: `${GATE_COOKIE_SHARED}=${value}`})
    assert.equal(await requestHasPass(headers("crew.staging.oliverstreetcreative.com",pass),now),true)
    assert.equal(await requestHasPass(headers("oliverstreetcreative.com",pass),now),false)
    assert.equal(await requestHasPass(headers("staging.oliverstreetcreative.com",pass.replace("v2.","v1.")),now),false)
    delete process.env.SESSION_JWT_SECRET
    assert.equal(await requestHasPass(headers("staging.oliverstreetcreative.com",pass),now),false)
  } finally { delete process.env.SESSION_JWT_SECRET }
})
