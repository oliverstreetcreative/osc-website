// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/auth/session-rules.test.ts
// The session's pure rules (SPEC §27 P0 v2): how the middleware reads a verified token, and when a row stops counting.
import { test } from "node:test"
import assert from "node:assert/strict"
import { IDLE_MS, edgeSession, rowProblem, type SessionRow } from "./session-rules"

const SID = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b"
const SCRIPT = "0b3c6c1e-5d2a-4f0e-9a7b-1c2d3e4f5a6b"

test("a token without a session id is no session (every pre-row cookie signs out once)", () => {
  assert.equal(edgeSession({ id: "p1", email: "jane@client.org", role: "CLIENT", is_staff: false }), null)
  assert.equal(edgeSession(null), null)
  assert.equal(edgeSession({ sid: SID, purpose: "magic_link", id: "p1" }), null)
  assert.equal(edgeSession({ sid: SID }), null) // neither a person nor a scope
  const s = edgeSession({ sid: SID, id: "p1", email: "jane@client.org", role: "CLIENT", is_staff: false, preview: true })
  assert.ok(s)
  assert.equal(s?.id, "p1")
  assert.equal(s?.preview, true)
  assert.equal(s?.scope, null)
})

test("a script invite's token is never a person, even if it claims to be staff", () => {
  const s = edgeSession({ sid: SID, scope: `script:${SCRIPT}`, id: "p1", is_staff: true, role: "STAFF", email: "x@y.z" })
  assert.ok(s)
  assert.deepEqual(s?.scope, { kind: "script", id: SCRIPT })
  assert.equal(s?.id, "")
  assert.equal(s?.is_staff, false)
  assert.equal(s?.role, "")
  assert.equal(edgeSession({ sid: SID, scope: "org:acme", id: "p1" }), null)
})

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  revoked_at: null,
  expires_at: new Date("2026-12-31T00:00:00Z"),
  last_active_at: new Date("2026-10-04T12:00:00Z"),
  token_hash: "h",
  scope: null,
  ...over,
})
const NOW = Date.parse("2026-10-05T12:00:00Z")

test("a row counts only while it's live, for its own token, for its own scope", () => {
  assert.equal(rowProblem(row(), "h", null, NOW, true), null)
  assert.equal(rowProblem(null, "h", null, NOW, true), "no such session")
  assert.equal(rowProblem(row({ revoked_at: new Date() }), "h", null, NOW, true), "signed out")
  assert.equal(rowProblem(row({ expires_at: new Date("2026-10-01T00:00:00Z") }), "h", null, NOW, true), "expired")
  assert.equal(rowProblem(row(), "someone else's", null, NOW, true), "not this token's session")
  assert.equal(rowProblem(row({ last_active_at: new Date(NOW - IDLE_MS - 1) }), "h", null, NOW, true), "idle too long")
  assert.equal(rowProblem(row(), "h", null, NOW, false), "switched off") // the caller's admission says no
  // A full token can't ride a scoped row, nor the other way round.
  assert.equal(rowProblem(row({ scope: `script:${SCRIPT}` }), "h", null, NOW, true), "scope mismatch")
  assert.equal(rowProblem(row(), "h", { kind: "script", id: SCRIPT }, NOW, true), "scope mismatch")
  assert.equal(rowProblem(row({ scope: `script:${SCRIPT}` }), "h", { kind: "script", id: SCRIPT }, NOW, true), null)
})
