// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/sign-calls.test.ts
// What the portal SENDS Sign Here outside staging (SPEC §22 v2.1), with fetch stubbed: a real org asks under its own
// slug; a rehearsal (the signing twin included), demo or preview org never calls at all; samples never show.
// The env is set before the module loads (IS_STAGING is read once); node --test runs each file in its own process.
import { test } from "node:test"
import assert from "node:assert/strict"
import { SIGN_TWIN } from "./rehearsal"

delete process.env.SITE_ENV
process.env.RAILWAY_ENVIRONMENT_NAME = "production"
process.env.SIGN_HERE_URL = "https://sign.test"
process.env.SIGN_HERE_SERVICE_TOKEN = "test-token"
process.env.SIGN_SHOW_SAMPLES = "1" // must change nothing outside staging

type Call = { url: string; method: string; headers: Record<string, string> }
const calls: Call[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string> })
  const url = String(input)
  if (url.includes("/needed/")) return Response.json({ contract: 2, job: "x", items: [] })
  if (url.includes("/start/")) return Response.json({ agreement_id: "ag1", sign_url: "/sign/a/ag1" })
  return new Response("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } })
}) as typeof fetch

const load = () => import("./sign")

test("a real org asks under its own published slug, as the viewer or as staff", async () => {
  const { neededForJob, startSigning, receipt } = await load()
  calls.length = 0
  assert.deepEqual(await neededForJob("26-015", "beech-acres", { email: "pat@beech.org" }), { ok: true, items: [] })
  assert.equal(calls[0].url, "https://sign.test/sign/api/v2/needed/26-015")
  assert.equal(calls[0].headers["X-Sign-Org"], "beech-acres")
  assert.equal(calls[0].headers["X-Sign-Viewer"], "pat@beech.org")
  await neededForJob("26-015", "beech-acres", { staff: true })
  assert.equal(calls[1].headers["X-Sign-Staff"], "1")
  assert.equal(calls[1].headers["X-Sign-Viewer"], undefined)
  assert.deepEqual(await startSigning("26-015", "beech-acres", "pat@beech.org", "i1"), { ok: true, sign_url: "/sign/a/ag1" })
  assert.equal(calls[2].method, "POST")
  assert.equal(calls[2].headers["X-Sign-Org"], "beech-acres")
  assert.ok(await receipt("ag1", "beech-acres", "pat@beech.org"))
  assert.equal(calls[3].headers["X-Sign-Org"], "beech-acres")
})

test("outside staging the twin, other rehearsals, the demo and previews never call Sign Here", async () => {
  const { neededForJob, startSigning, receipt } = await load()
  calls.length = 0
  for (const slug of [SIGN_TWIN.slug, "rehearsal-osc", "demo-fernwood", "beech-acres--preview"]) {
    assert.equal(await neededForJob("99-002", slug, { email: SIGN_TWIN.email }), null, slug)
    assert.deepEqual(await startSigning("99-002", slug, SIGN_TWIN.email, "i1"), { ok: false, reason: "unavailable" }, slug)
    assert.equal(await receipt("ag1", slug, SIGN_TWIN.email), null, slug)
  }
  assert.equal(calls.length, 0)
})

test("outside staging a client never sees a sample, whatever SIGN_SHOW_SAMPLES says", async () => {
  const { forClient, showSamples } = await load()
  assert.equal(showSamples(), false)
  const sample = { id: "s", job: "26-015", kind: "talent_release" as const, date: null, who: { name: "Pat", email: "pat@beech.org" }, can_start: true, status: "missing" as const, agreement_id: null, signed_at: null, sample: true }
  assert.deepEqual(forClient([sample], { email: "pat@beech.org" }), [])
})
