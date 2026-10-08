// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/staging/gate.test.ts
// Staging's password gate (client-website SPEC §32 v2): the pass, the exemptions, `next`.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  GATE_COOKIE_PLAIN, GATE_COOKIE_SECURE, PASS_SECONDS, cookieFrom, gateExemption, makePass, passCookie, passValid,
  passwordUsable, requestHasPass, safeNext, withoutPass,
} from "./gate"

const PW = "correct-horse-battery-1"
const NOW = 1_800_000_000

test("a pass verifies with its password until it expires, and never with another password", async () => {
  const pass = await makePass(PW, NOW + 3600)
  assert.match(pass, /^v1\.\d{10}\.[A-Za-z0-9_-]{43}$/)
  assert.equal(await passValid(pass, PW, NOW), true)
  assert.equal(await passValid(pass, PW, NOW + 3599), true)
  assert.equal(await passValid(pass, PW, NOW + 3600), false) // expired at exp
  assert.equal(await passValid(pass, "another-password-xyz", NOW), false) // a new password ends every pass
})

test("a pass can't be stretched, forged or stuffed", async () => {
  const pass = await makePass(PW, NOW + 3600)
  const [, , sig] = pass.split(".")
  assert.equal(await passValid(`v1.${NOW + 999999}.${sig}`, PW, NOW), false) // a later expiry with the old signature
  assert.equal(await passValid(await makePass(PW, NOW + PASS_SECONDS + 3 * 86400), PW, NOW), false) // further out than any pass
  assert.equal(await passValid(`v1.${NOW + 3600}.${"A".repeat(43)}`, PW, NOW), false)
  for (const junk of [undefined, null, "", "v1", "v2." + pass.slice(3), pass + "x", pass.replace("v1.", "v1.0"), "x".repeat(500)]) {
    assert.equal(await passValid(junk as string, PW, NOW), false, String(junk).slice(0, 20))
  }
})

test("a short or missing password closes staging (the gate fails closed)", () => {
  assert.equal(passwordUsable(undefined), null)
  assert.equal(passwordUsable(""), null)
  assert.equal(passwordUsable("fifteen-chars!!"), null) // 15
  assert.equal(passwordUsable("  sixteen-chars!!!  "), "sixteen-chars!!!") // 16, trimmed
})

test("exemptions are exact: path AND method", () => {
  assert.equal(gateExemption("/staging-gate", "GET"), "gate")
  assert.equal(gateExemption("/staging-gate", "HEAD"), "gate")
  assert.equal(gateExemption("/staging-gate", "POST"), null)
  assert.equal(gateExemption("/staging-gate/enter", "POST"), "gate")
  assert.equal(gateExemption("/staging-gate/enter", "GET"), null)
  assert.equal(gateExemption("/staging-gate/other", "GET"), null)
  assert.equal(gateExemption("/robots.txt", "GET"), "open")
  assert.equal(gateExemption("/robots.txt", "POST"), null)
  assert.equal(gateExemption("/api/scripts/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/render", "GET"), "open")
  assert.equal(gateExemption("/api/scripts/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/render", "POST"), null)
  assert.equal(gateExemption("/api/scripts/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", "GET"), null)
  assert.equal(gateExemption("/api/auth/preview", "GET"), "open")
  assert.equal(gateExemption("/api/auth/code", "POST"), null) // sign-in stays behind the gate
  assert.equal(gateExemption("/api/auth/request-magic-link", "POST"), null)
  assert.equal(gateExemption("/magic", "GET"), null)
  assert.equal(gateExemption("/f/abc", "GET"), null)
  assert.equal(gateExemption("/demo/some-token", "GET"), "open")
  assert.equal(gateExemption("/demo/some-token/x", "GET"), null)
  assert.equal(gateExemption("/demo/some-token", "POST"), null)
  assert.equal(gateExemption("/calendar/abc123.ics", "GET"), "open")
  assert.equal(gateExemption("/calendar/abc123.ics", "HEAD"), "open")
  assert.equal(gateExemption("/calendar/abc123.ics", "POST"), null)
  assert.equal(gateExemption("/calendar/a/b", "GET"), null)
  assert.equal(gateExemption("/id/session-status", "POST"), "open") // server to server, its own client credentials
  assert.equal(gateExemption("/id/session-status", "GET"), null)
  assert.equal(gateExemption("/id/deputies", "GET"), null) // the one sign-in's pages stay behind the gate
  assert.equal(gateExemption("/client", "GET"), "demo")
  assert.equal(gateExemption("/client/projects/x", "GET"), "demo")
  assert.equal(gateExemption("/client-logos/acme.png", "GET"), "demo")
  assert.equal(gateExemption("/clientele", "GET"), null)
  assert.equal(gateExemption("/", "GET"), null) // the redesign's drafts stay behind it
  assert.equal(gateExemption("/pricing", "GET"), null)
})

test("without a pass: page reads see the gate; everything else is refused", () => {
  assert.equal(withoutPass("/", "GET"), "gate-page")
  assert.equal(withoutPass("/client/start", "HEAD"), "gate-page")
  assert.equal(withoutPass("/og-image.png", "GET"), "gate-page")
  assert.equal(withoutPass("/api/estimate", "GET"), "refuse")
  assert.equal(withoutPass("/api", "GET"), "refuse")
  assert.equal(withoutPass("/client/start/save", "POST"), "refuse")
  assert.equal(withoutPass("/", "OPTIONS"), "refuse")
  // a browser OPENING an /api link (the quote desk's unlock link) gets the gate, then lands there
  assert.equal(withoutPass("/api/quote-desk/unlock", "GET", true), "gate-page")
  assert.equal(withoutPass("/api/quote-desk/unlock", "POST", true), "refuse")
})

test("next is a path on this site or /", () => {
  assert.equal(safeNext("/client/start?x=1"), "/client/start?x=1")
  assert.equal(safeNext("/login?demo_ended=1"), "/login?demo_ended=1")
  assert.equal(safeNext("/magic?token=abc"), "/magic?token=abc")
  for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "evil", "", "/a\nb", "/a\\b", "/staging-gate", "/staging-gate?next=/x", "/staging-gate/enter", 42, null, "/" + "a".repeat(2001)]) {
    assert.equal(safeNext(bad), "/", String(bad).slice(0, 30))
  }
})

test("cookies: the __Host- pass everywhere, the plain one only on localhost", async () => {
  assert.equal(cookieFrom("a=1; __Host-osc_gate=v1.x; b=2", GATE_COOKIE_SECURE), "v1.x")
  assert.equal(cookieFrom("a=1", GATE_COOKIE_SECURE), undefined)
  assert.equal(cookieFrom(null, GATE_COOKIE_SECURE), undefined)
  const pass = await makePass(PW, Math.floor(Date.now() / 1000) + 3600)
  const was = process.env.STAGING_PASSWORD
  process.env.STAGING_PASSWORD = PW
  try {
    const h = (host: string, cookie: string) => new Headers({ host, cookie })
    assert.equal(await requestHasPass(h("osc-website-staging.up.railway.app", `${GATE_COOKIE_SECURE}=${pass}`)), true)
    assert.equal(await requestHasPass(h("osc-website-staging.up.railway.app", `${GATE_COOKIE_PLAIN}=${pass}`)), false)
    assert.equal(await requestHasPass(h("localhost:3000", `${GATE_COOKIE_PLAIN}=${pass}`)), true)
    assert.equal(await requestHasPass(h("osc-website-staging.up.railway.app", "")), false)
    process.env.STAGING_PASSWORD = "short"
    assert.equal(await requestHasPass(h("osc-website-staging.up.railway.app", `${GATE_COOKIE_SECURE}=${pass}`)), false) // closed
  } finally {
    if (was === undefined) delete process.env.STAGING_PASSWORD
    else process.env.STAGING_PASSWORD = was
  }
  assert.deepEqual(passCookie(true, 60), { name: GATE_COOKIE_SECURE, options: { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 } })
  assert.equal(passCookie(false, 60).name, GATE_COOKIE_PLAIN)
})

test("the pass format is pinned (the Python driver computes the same bytes)", async () => {
  // HMAC-SHA256(key "correct-horse-battery-1", "osc-staging-gate:v1|1800003600"), base64url without padding.
  const { createHmac } = await import("node:crypto")
  const want = createHmac("sha256", PW).update("osc-staging-gate:v1|1800003600").digest("base64url")
  assert.equal(await makePass(PW, 1800003600), `v1.1800003600.${want}`)
})
