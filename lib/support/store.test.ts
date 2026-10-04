// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/support/store.test.ts
// What a report may keep (SPEC §29 v2): numbers, enums, route templates and short redacted text; a screenshot only
// when it really is a small JPEG; an address only as a keyed hash, an IPv6 by its /64. Tests lib/support/clean.ts,
// the database-free half of store.ts (the pg driver won't load under the test loader).
import { test } from "node:test"
import assert from "node:assert/strict"
import { cleanContext, cleanWords, decodeScreenshot, ipHash, ipKey } from "./clean"
import { errorCounts, summaryMarkdown, type SummaryFacts } from "./safety"

test("the context keeps numbers, enums and route templates, nothing else", () => {
  const c = cleanContext(
    {
      viewport: { w: 390.4, h: 844, dpr: 3 },
      scheme: "dark",
      online: true,
      errors: [
        { kind: "rejection", msg: "fetch failed for eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJl", at: 1 },
        { kind: "rm -rf", msg: 5 },
      ],
      failed: [
        { method: "post", path: "/client/scripts/invite/SECRETTOKEN", status: 500, at: 2 },
        { method: "TRACE", path: "https://elsewhere.example/x?token=1", status: 99999 },
      ],
      cookies: "never kept",
    },
    false,
  )
  assert.deepEqual(c.viewport, { w: 390, h: 844, dpr: 3 })
  assert.equal(c.scheme, "dark")
  assert.equal(c.online, true)
  assert.equal(c.errors[0].kind, "rejection")
  assert.match(c.errors[0].msg, /\[redacted-jwt\]/)
  assert.doesNotMatch(c.errors[0].msg, /eyJ/)
  assert.deepEqual(c.errors[1], { kind: "js_error", msg: "", at: null })
  assert.deepEqual(c.failed[0], { method: "POST", route: "/client/scripts/invite/[token]", status: 500, at: 2 })
  assert.deepEqual(c.failed[1], { method: "GET", route: "other", status: 999, at: null })
  assert.ok(!("cookies" in c))
})

test("the context is capped: 20 of each, 300 characters a message", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ kind: "js_error", msg: "x".repeat(1000), at: i }))
  const c = cleanContext({ errors: many, failed: many.map((m) => ({ ...m, path: "/client", status: 404 })) }, false)
  assert.equal(c.errors.length, 20)
  assert.equal(c.failed.length, 20)
  assert.equal(c.errors[0].at, 30) // the LAST twenty
  assert.ok(c.errors.every((e) => e.msg.length <= 300))
  assert.deepEqual(cleanContext("not an object", true), { viewport: { w: null, h: null, dpr: null }, scheme: null, online: null, errors: [], failed: [] })
})

test("on client.*, a path without /client is still a template", () => {
  const c = cleanContext({ failed: [{ method: "GET", path: "/projects/abc", status: 404 }] }, true)
  assert.equal(c.failed[0].route, "/client/projects/[project]")
})

test("a screenshot is a small JPEG data URL, or nothing", () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)])
  const ok = decodeScreenshot(`data:image/jpeg;base64,${jpeg.toString("base64")}`)
  assert.ok(ok && ok.length === jpeg.length)
  assert.equal(decodeScreenshot(`data:image/png;base64,${jpeg.toString("base64")}`), null)
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(decodeScreenshot(`data:image/jpeg;base64,${png.toString("base64")}`), null) // the bytes must BE a JPEG
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1_000_001)])
  assert.equal(decodeScreenshot(`data:image/jpeg;base64,${big.toString("base64")}`), null)
  assert.equal(decodeScreenshot("data:image/jpeg;base64,<svg onload=x>"), null)
  assert.equal(decodeScreenshot(42), null)
})

test("an address is never kept; an IPv6 counts by its /64, however it's written", () => {
  assert.equal(ipKey("2001:db8::1"), "2001:db8:0:0::/64")
  assert.equal(ipKey("2001:0db8:0000:0000:ffff::2"), "2001:db8:0:0::/64")
  assert.equal(ipKey("[2001:db8:1:2:aaaa::1]"), "2001:db8:1:2::/64")
  assert.equal(ipKey("fe80::1%en0"), "fe80:0:0:0::/64")
  assert.equal(ipKey("::ffff:203.0.113.9"), "203.0.113.9")
  assert.equal(ipKey("203.0.113.9"), "203.0.113.9")
  const a = ipHash("2001:db8:1:2:aaaa::1")
  assert.equal(a, ipHash("2001:db8:1:2:bbbb::9"))
  assert.notEqual(a, ipHash("2001:db8:1:3::1"))
  assert.match(a ?? "", /^[0-9a-f]{32}$/)
  assert.equal(ipHash(null), null)
})

test("the words are trimmed, redacted and capped", () => {
  assert.equal(cleanWords("  the link ?token=abc123 broke  "), "the link ?token=[redacted] broke")
  assert.equal(cleanWords("word ".repeat(1000)).length, 2000)
  assert.equal(cleanWords("x".repeat(5000)), "[redacted-token]") // one unbroken 5,000-character run reads as a token
  assert.equal(cleanWords("   "), "")
  assert.equal(cleanWords({ message: "hi" }), "")
})

test("error counts: the page's errors by kind, failed requests by status class", () => {
  const n = errorCounts({
    errors: [{ kind: "js_error" }, { kind: "rejection" }, { kind: "made-up" }],
    failed: [{ status: 404 }, { status: 503 }, { status: 0 }, {}],
  })
  assert.deepEqual(n, { js_error: 2, rejection: 1, http_4xx: 1, http_5xx: 1, network: 2 })
  assert.deepEqual(errorCounts(null), {})
})

test("the summary validates what came out of the database too", () => {
  const f = {
    id: "0b3c6c1e-5d2a-4f0e-9a7b-1c2d3e4f5a6b",
    number: 3,
    env: "prod; rm -rf",
    surface: "portal",
    client: "Not A Slug!",
    route: "/client/projects/real-secret-path",
    role: "GOD",
    device: "phone\n- client: acme",
    browser: "netscape",
    viewport: { w: 390, h: 844 },
    errors: {},
    screenshot: false,
    created: "2026-10-04T20:00:00.000Z",
    words: "hello",
  } as unknown as SummaryFacts
  const md = summaryMarkdown(f)
  assert.match(md, /^# Support report #3 · unknown /)
  assert.match(md, /^- client: \(none\)$/m)
  assert.match(md, /^- page: other$/m)
  assert.match(md, /^- signed in: no$/m)
  assert.match(md, /^- device: unknown · other · 390×844$/m)
  assert.doesNotMatch(md, /acme|real-secret|GOD|netscape|rm -rf/)
})
