// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/idp/rules.test.ts
// The one sign-in's pure rules (SPEC §27 P1 v2): admission, osc_admin's 12 hours, the step-up, grants, the registry.
import { test } from "node:test"
import assert from "node:assert/strict"
import { ADMIN_HOURS, admit, cleanGrant, oscAdmin, stepUpFresh, type GrantLite } from "./rules"
import { exactlyRegistered, registry } from "./clients"

const NOW = new Date("2026-10-06T20:00:00Z")
const grant = (over: Partial<GrantLite> = {}): GrantLite => ({
  email: "kris@example.com",
  surfaces: ["sign"],
  scope: "all",
  until: new Date("2026-11-01T00:00:00Z"),
  revoked_at: null,
  ...over,
})

test("admission: a switched-off person is a hard deny, whatever else they are", () => {
  assert.deepEqual(admit({ person: { id: "p", portal_allowed: false }, owner: true, grants: [grant()], now: NOW }), { ok: false, why: "switched_off" })
  assert.equal(admit({ person: { id: "p", portal_allowed: true }, owner: false, grants: [], now: NOW }).ok, true)
  assert.equal(admit({ person: null, owner: true, grants: [], now: NOW }).ok, true)
  assert.equal(admit({ person: null, owner: false, grants: [grant()], now: NOW }).ok, true)
  // An expired or revoked grant admits no one.
  assert.deepEqual(admit({ person: null, owner: false, grants: [grant({ until: new Date("2026-10-01") })], now: NOW }), { ok: false, why: "unknown" })
  assert.deepEqual(admit({ person: null, owner: false, grants: [grant({ revoked_at: NOW })], now: NOW }), { ok: false, why: "unknown" })
})

test("osc_admin: the owner or a covering grant, and only while the sign-in is under 12 hours old", () => {
  const fresh = new Date(NOW.getTime() - 3600_000)
  const owner = oscAdmin({ owner: true, grants: [], surface: "sign", authTime: fresh, now: NOW })
  assert.equal(owner?.role, "owner")
  assert.equal(owner?.scope, "all")
  assert.equal(owner?.until, new Date(fresh.getTime() + ADMIN_HOURS * 3600_000).toISOString())
  // 12 hours after the sign-in: no admin claim, owner or not.
  const stale = new Date(NOW.getTime() - ADMIN_HOURS * 3600_000)
  assert.equal(oscAdmin({ owner: true, grants: [], surface: "sign", authTime: stale, now: NOW }), null)
  // A deputy: only grants that cover THIS surface, scopes merged, the earlier end wins.
  const d = oscAdmin({
    owner: false,
    grants: [grant({ scope: ["26-033"] }), grant({ scope: ["26-012", "26-033"], until: new Date("2026-10-06T22:00:00Z") }), grant({ surfaces: ["hub"] })],
    surface: "sign",
    authTime: fresh,
    now: NOW,
  })
  assert.deepEqual(d?.scope, ["26-012", "26-033"])
  assert.equal(d?.role, "deputy")
  assert.equal(d?.until, new Date(fresh.getTime() + ADMIN_HOURS * 3600_000).toISOString()) // the session's 12 hours end first
  assert.equal(oscAdmin({ owner: false, grants: [grant({ surfaces: ["hub"] })], surface: "sign", authTime: fresh, now: NOW }), null)
  assert.equal(oscAdmin({ owner: false, grants: [grant(), grant({ scope: ["26-012"] })], surface: "sign", authTime: fresh, now: NOW })?.scope, "all")
})

test("the step-up: a link or code sign-in under 10 minutes old", () => {
  assert.ok(stepUpFresh({ created_at: new Date(NOW.getTime() - 60_000), amr: "code" }, NOW))
  assert.ok(stepUpFresh({ created_at: new Date(NOW.getTime() - 60_000), amr: "link" }, NOW))
  assert.ok(!stepUpFresh({ created_at: new Date(NOW.getTime() - 11 * 60_000), amr: "code" }, NOW))
  assert.ok(!stepUpFresh({ created_at: new Date(NOW.getTime() - 60_000), amr: "invite" }, NOW))
  assert.ok(!stepUpFresh({ created_at: new Date(NOW.getTime() - 60_000), amr: null }, NOW))
})

test("a grant: a real address, all or job codes, an end within 90 days", () => {
  const ok = cleanGrant({ email: " Kris@Example.com ", scope: "26-012, 26-033 26-012", until: "2026-10-20", reason: "Torres paper" }, "sam@oliverstreetcreative.com", NOW)
  assert.ok(ok.ok)
  if (ok.ok) {
    assert.equal(ok.grant.email, "kris@example.com")
    assert.deepEqual(ok.grant.scope, ["26-012", "26-033"])
  }
  assert.equal(cleanGrant({ email: "kris@example.com", scope: "", until: "2026-10-20", reason: "" }, "sam@x.com", NOW).ok, true)
  for (const [input, why] of [
    [{ email: "nope", scope: "all", until: "2026-10-20", reason: "" }, /email/],
    [{ email: "sam@x.com", scope: "all", until: "2026-10-20", reason: "" }, /owner/],
    [{ email: "k@x.com", scope: "Torres", until: "2026-10-20", reason: "" }, /codes like/],
    [{ email: "k@x.com", scope: "all", until: "2026-10-01", reason: "" }, /future/],
    [{ email: "k@x.com", scope: "all", until: "2027-03-01", reason: "" }, /90 days/],
    [{ email: "k@x.com", scope: "all", until: "soon", reason: "" }, /last day/],
  ] as const) {
    const r = cleanGrant(input, "sam@x.com", NOW)
    assert.ok(!r.ok && why.test(r.why), JSON.stringify(input))
  }
})

test("the registry: per environment, exact URIs, production never lists staging", () => {
  const prod = registry("production", () => "https://forms-staging.up.railway.app")
  assert.deepEqual(prod.map((c) => c.client_id), ["sign"])
  assert.deepEqual(prod[0].redirect_uris, ["https://sign.oliverstreetcreative.com/auth/oidc/callback"])
  const staging = registry("staging", (n) => (n === "IDP_SIGN_ORIGIN" ? "https://forms-staging.up.railway.app/" : undefined))
  assert.deepEqual(staging.map((c) => c.client_id), ["sign", "test"])
  assert.equal(staging[0].redirect_uris[0], "https://forms-staging.up.railway.app/auth/oidc/callback")
  // Staging never registers production's host, and a bad origin drops the client instead of guessing.
  assert.deepEqual(registry("staging", () => "https://sign.oliverstreetcreative.com").map((c) => c.client_id), ["test"])
  assert.deepEqual(registry("staging", () => "javascript:alert(1)").map((c) => c.client_id), ["test"])
  const uris = prod[0].redirect_uris
  assert.ok(exactlyRegistered(uris, "https://sign.oliverstreetcreative.com/auth/oidc/callback"))
  assert.ok(!exactlyRegistered(uris, "https://sign.oliverstreetcreative.com/auth/oidc/callback/"))
  assert.ok(!exactlyRegistered(uris, "https://sign.oliverstreetcreative.com/auth/oidc/callback?x=1"))
  assert.ok(!exactlyRegistered(uris, "HTTPS://sign.oliverstreetcreative.com/auth/oidc/callback"))
})
