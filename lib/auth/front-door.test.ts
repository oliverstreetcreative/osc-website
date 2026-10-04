// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/auth/front-door.test.ts
// The front door's pure rules (SPEC §27 P0): redirects, the script scope, the limits, the code.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ALARMS, CODE_LIMITS, LINK_LIMITS, alarmFor, codeHash, codeMatches, deviceHash, emailHash, maySendLink, mayTryCode, newCode,
  newDeviceId, normalizeCode, parseScope, safeRedirect, scopeAllows, signinIpKey,
} from "./front-door"

test("a sign-in lands only on this host, under /client, /crew or /admin", () => {
  assert.equal(safeRedirect("/client/projects/spots"), "/client/projects/spots")
  assert.equal(safeRedirect("/client/projects/spots?tab=money#x"), "/client/projects/spots?tab=money")
  assert.equal(safeRedirect("/crew"), "/crew")
  assert.equal(safeRedirect("/admin/support"), "/admin/support")
  assert.equal(safeRedirect("/client/../admin"), "/admin") // resolved, then judged
  for (const bad of [
    "", "client", "https://evil.example/client", "//evil.example/client", "/\\evil.example", "/%2F%2Fevil.example",
    "%2F%2Fevil.example", "/clientx", "/work/x", "/client/../work", "javascript:alert(1)", "/client\u0000x",
    "/" + "a".repeat(600), "/%E0%A4%A", 42, null,
  ]) {
    assert.equal(safeRedirect(bad), null, String(bad))
  }
})

test("a script scope: its own script, its print view, its API, and the way out", () => {
  const id = "0b3c6c1e-5d2a-4f0e-9a7b-1c2d3e4f5a6b"
  const s = parseScope(`script:${id}`)
  if (!s || s === "bad") return assert.fail("the scope should parse")
  for (const ok of [
    `/client/scripts/${id}`, `/client/scripts/${id}/`, `/client/scripts/${id.toUpperCase()}`, `/client/scripts/${id}/print`,
    `/api/scripts/${id}`, `/api/scripts/${id}/events`, `/api/scripts/${id}/updates`, "/client/signout", "/client/account",
    "/client/support/report", "/_next/static/chunks/x.js", "/api/auth/logout", "/login", "/magic",
  ]) {
    assert.ok(scopeAllows(s, ok), ok)
  }
  for (const no of [
    "/client", "/client/projects", "/client/scripts", "/client/scripts/0b3c6c1e-5d2a-4f0e-9a7b-1c2d3e4f5a6c",
    `/api/scripts/x/../${id}/events`, `/client/scripts/${id}/../../billing`, "/api/auth/sessions/revoke-all", "/api/auth/code",
    `/client/scripts/${id}%2F..%2F..%2Fbilling`, "/admin", "/client/billing", "/api/portal/activity", "/client/support",
  ]) {
    assert.ok(!scopeAllows(s, no), no)
  }
  assert.equal(parseScope(undefined), null)
  assert.equal(parseScope("script:nope"), "bad")
  assert.equal(parseScope("org:acme"), "bad")
  assert.equal(parseScope(7), "bad")
})

test("link requests: per address and per network; a known device skips the per-address caps", () => {
  const ok = { address15: 0, addressDay: 0, ipHour: 0 }
  assert.ok(maySendLink(ok))
  assert.ok(!maySendLink({ ...ok, address15: LINK_LIMITS.addressPer15Min }))
  assert.ok(!maySendLink({ ...ok, addressDay: LINK_LIMITS.addressPerDay }))
  assert.ok(!maySendLink({ ...ok, ipHour: LINK_LIMITS.ipPerHour }))
  // Someone asking for Sam's crew's links all day can't lock them out of their own phone.
  assert.ok(maySendLink({ ...ok, addressDay: 99, address15: 99, knownDevice: true }))
  assert.ok(!maySendLink({ ...ok, ipHour: LINK_LIMITS.ipPerHour, knownDevice: true }))
})

test("code tries: per code and per network always; per address unless it's a known device", () => {
  const ok = { codeTries: 0, addressFailsDay: 0, ipFailsHour: 0 }
  assert.ok(mayTryCode(ok))
  assert.ok(mayTryCode({ ...ok, codeTries: CODE_LIMITS.triesPerCode - 1 }))
  assert.ok(!mayTryCode({ ...ok, codeTries: CODE_LIMITS.triesPerCode }))
  assert.ok(!mayTryCode({ ...ok, addressFailsDay: CODE_LIMITS.addressFailsPerDay }))
  assert.ok(mayTryCode({ ...ok, addressFailsDay: CODE_LIMITS.addressFailsPerDay, knownDevice: true }))
  assert.ok(!mayTryCode({ ...ok, ipFailsHour: CODE_LIMITS.ipFailsPerHour, knownDevice: true }))
  assert.ok(!mayTryCode({ ...ok, codeTries: CODE_LIMITS.triesPerCode, knownDevice: true }))
})

test("global numbers raise an alarm, never switch sign-in off", () => {
  assert.equal(alarmFor({ sendsHour: 0, codeFailsDay: 0 }), null)
  assert.match(alarmFor({ sendsHour: ALARMS.sendsPerHour, codeFailsDay: 0 }) ?? "", /links/)
  assert.match(alarmFor({ sendsHour: 0, codeFailsDay: ALARMS.codeFailsPerDay }) ?? "", /codes/)
})

test("sign-in counts an IPv6 by its /48", () => {
  assert.equal(signinIpKey("2001:db8:1:2::1"), "2001:db8:1::/48")
  assert.equal(signinIpKey("2001:db8:1:ffff:aaaa::9"), "2001:db8:1::/48")
  assert.notEqual(signinIpKey("2001:db8:2::1"), signinIpKey("2001:db8:1::1"))
  assert.equal(signinIpKey("::ffff:203.0.113.9"), "203.0.113.9")
  assert.equal(signinIpKey("203.0.113.9"), "203.0.113.9")
})

test("device ids are random and stored only as hashes", () => {
  const a = newDeviceId()
  assert.match(a, /^[A-Za-z0-9_-]{32}$/)
  assert.notEqual(a, newDeviceId())
  assert.match(deviceHash(a), /^[0-9a-f]{64}$/)
  assert.ok(!deviceHash(a).includes(a))
})

test("the code: six digits, bound to its invite, checked in constant time", () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^\d{6}$/)
  assert.equal(normalizeCode("123 456"), "123456")
  assert.equal(normalizeCode("123-456"), "123456")
  assert.equal(normalizeCode("12345"), null)
  assert.equal(normalizeCode("12345a"), null)
  assert.equal(normalizeCode(123456), null)
  const h = codeHash("invite-1", "004219", "k")
  assert.ok(codeMatches(h, "invite-1", "004219", "k"))
  assert.ok(!codeMatches(h, "invite-2", "004219", "k")) // another invite's code never works here
  assert.ok(!codeMatches(h, "invite-1", "004218", "k"))
  assert.ok(!codeMatches(h, "invite-1", "004219", "other-key"))
  assert.ok(!codeMatches(null, "invite-1", "004219", "k"))
  assert.ok(!codeMatches("zz", "invite-1", "004219", "k"))
  assert.equal(emailHash(" Jane@Client.org ", "k"), emailHash("jane@client.org", "k"))
  assert.notEqual(emailHash("jane@client.org", "k"), emailHash("jane@client.org", "k2"))
  assert.doesNotMatch(emailHash("jane@client.org", "k"), /jane/)
})
