// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/idp/flow.test.ts
// The one sign-in's flow rules (SPEC §27 P1 v2 #3, #5, #6): the login check, the bridge's screens, and the claims.
import { test } from "node:test"
import assert from "node:assert/strict"
import { accountClaims, loginFrom } from "./claims"
import { loginNeeded } from "./prompt"
import { bridgeScreen } from "./bridge"
import { admit, type GrantLite } from "./rules"

const NOW = new Date("2026-10-06T20:00:00Z")
const row = (over: Record<string, unknown> = {}) => ({
  revoked_at: null,
  expires_at: new Date("2026-12-31T00:00:00Z"),
  last_active_at: new Date(NOW.getTime() - 60_000),
  token_hash: "h",
  scope: null,
  kind: "person",
  amr: "link" as string | null,
  subject_id: "sub-dana" as string | null,
  created_at: new Date(NOW.getTime() - 2 * 3600_000),
  ...over,
})
const grant = (over: Partial<GrantLite> = {}): GrantLite => ({
  email: "kris@example.com",
  surfaces: ["sign"],
  scope: ["26-012"],
  until: new Date("2026-11-01T00:00:00Z"),
  revoked_at: null,
  ...over,
})

test("the login a finished interaction hands over is the ROW's own time and proof", () => {
  const r = row()
  assert.deepEqual(loginFrom(r), { accountId: "sub-dana", ts: Math.floor(r.created_at.getTime() / 1000), amr: ["link"] })
  assert.deepEqual(loginFrom(row({ amr: "code" }))?.amr, ["code"])
  // Rows the IdP can't stand behind.
  for (const bad of [{ kind: "script" }, { kind: "preview" }, { kind: "demo" }, { amr: null }, { amr: "invite" }, { subject_id: null }]) {
    assert.equal(loginFrom(row(bad)), null, JSON.stringify(bad))
  }
})

test("claims: verified, lowercased, named honestly; osc_admin only for a covering grant inside the 12 hours", () => {
  const person = admit({ person: { id: "p", portal_allowed: true }, owner: false, grants: [], now: NOW })
  const c = accountClaims({ sub: "sub-dana", email: " Dana@Fernwood.example ", name: "Dana Whitfield", admission: person, surface: "sign", authTime: new Date(NOW.getTime() - 3600_000), now: NOW })
  assert.deepEqual(c, { sub: "sub-dana", email: "dana@fernwood.example", email_verified: true, name: "Dana Whitfield" })
  // A deputy with no person record: named by their address, admin on the surface their grant covers.
  const deputy = admit({ person: null, owner: false, grants: [grant()], now: NOW })
  const k = accountClaims({ sub: "sub-kris", email: "kris@example.com", name: null, admission: deputy, surface: "sign", authTime: new Date(NOW.getTime() - 3600_000), now: NOW })
  assert.equal(k?.name, "kris@example.com")
  assert.deepEqual(k?.osc_admin?.scope, ["26-012"])
  assert.equal(accountClaims({ sub: "sub-kris", email: "kris@example.com", name: null, admission: deputy, surface: "hub", authTime: new Date(NOW.getTime() - 3600_000), now: NOW })?.osc_admin, undefined)
  // 12 hours after the ORIGINAL sign-in: no admin, even though they're still signed in.
  const late = accountClaims({ sub: "sub-kris", email: "kris@example.com", name: null, admission: deputy, surface: "sign", authTime: new Date(NOW.getTime() - 12 * 3600_000), now: NOW })
  assert.ok(late)
  assert.equal(late?.osc_admin, undefined)
  // Not admitted now: no claims at all.
  const off = admit({ person: { id: "p", portal_allowed: false }, owner: true, grants: [], now: NOW })
  assert.equal(accountClaims({ sub: "sub-dana", email: "d@x.com", name: "D", admission: off, surface: "sign", authTime: NOW, now: NOW }), null)
})

test("the login check: the apex row is THE session", () => {
  const base = { row: row(), tokenHash: "h", admitted: true, accountId: "sub-dana", loginHint: null, subjectEmail: "dana@fernwood.example", now: NOW.getTime() }
  assert.equal(loginNeeded(base), null)
  assert.equal(loginNeeded({ ...base, accountId: null }), null) // no library session yet: the row signs them in
  assert.equal(loginNeeded({ ...base, row: null }), "no_session")
  assert.equal(loginNeeded({ ...base, tokenHash: null }), "no_session")
  assert.equal(loginNeeded({ ...base, row: row({ revoked_at: NOW }) }), "row") // signed out at the apex
  assert.equal(loginNeeded({ ...base, tokenHash: "someone else's" }), "row")
  assert.equal(loginNeeded({ ...base, row: row({ kind: "script", scope: "script:x" }) }), "row") // a scoped row never passes as a full one
  assert.equal(loginNeeded({ ...base, row: row({ kind: "preview" }) }), "not_idp")
  assert.equal(loginNeeded({ ...base, row: row({ amr: null }) }), "not_idp") // from before p1a: a fresh link or code, once
  assert.equal(loginNeeded({ ...base, admitted: false }), "not_admitted")
  assert.equal(loginNeeded({ ...base, accountId: "sub-kris" }), "other_account") // a tossed or stale library cookie
  assert.equal(loginNeeded({ ...base, loginHint: "kris@example.com" }), "hint")
  assert.equal(loginNeeded({ ...base, loginHint: " DANA@fernwood.example" }), null)
})

test("the bridge: continue, choose, or a (fresh) sign-in through the front door", () => {
  const dana = { login: { accountId: "sub-dana", ts: Math.floor(NOW.getTime() / 1000) - 7200, amr: ["link"] }, email: "dana@fernwood.example", name: "Dana Whitfield" }
  const ask = { live: dana, loginHint: null, freshSince: null, codeFirst: false, choice: null } as const
  assert.deepEqual(bridgeScreen(ask), { kind: "continue", login: dana.login })
  // Nobody signed in: the front door, with the hint filled in and code-first when the app asked for it.
  assert.deepEqual(bridgeScreen({ ...ask, live: null, loginHint: "Kris@Example.com", codeFirst: true }), { kind: "sign_in", email: "kris@example.com", codeFirst: true, fresh: false })
  // The surface expects someone else: ask, then do what they chose.
  assert.deepEqual(bridgeScreen({ ...ask, loginHint: "kris@example.com" }), {
    kind: "choose",
    current: { name: "Dana Whitfield", email: "dana@fernwood.example" },
    hint: "kris@example.com",
  })
  assert.deepEqual(bridgeScreen({ ...ask, loginHint: "kris@example.com", choice: "continue" }), { kind: "continue", login: dana.login })
  assert.deepEqual(bridgeScreen({ ...ask, loginHint: "kris@example.com", choice: "switch" }), { kind: "sign_in", email: "kris@example.com", codeFirst: false, fresh: false })
  // prompt=login / max_age: a sign-in older than asked for gets a fresh link or code; a new enough one continues.
  assert.deepEqual(bridgeScreen({ ...ask, freshSince: dana.login.ts + 60 }), { kind: "sign_in", email: "dana@fernwood.example", codeFirst: false, fresh: true })
  assert.deepEqual(bridgeScreen({ ...ask, freshSince: dana.login.ts }), { kind: "continue", login: dana.login })
})
