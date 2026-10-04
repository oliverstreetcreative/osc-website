// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/sign-calls-staging.test.ts
// What the portal SENDS Sign Here on STAGING (SPEC §22 v2.1), with fetch stubbed: ONLY the signing twin asks, as
// Sign Here's bundled test org; samples show to a client only with SIGN_SHOW_SAMPLES=1.
// The env is set before the module loads (IS_STAGING is read once); node --test runs each file in its own process.
import { test } from "node:test"
import assert from "node:assert/strict"
import { SIGN_TWIN } from "./rehearsal"

process.env.SITE_ENV = "staging"
process.env.SIGN_HERE_URL = "https://sign-staging.test"
process.env.SIGN_HERE_SERVICE_TOKEN = "test-token"

type Call = { url: string; headers: Record<string, string> }
const calls: Call[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> })
  const url = String(input)
  if (url.includes("/needed/")) return Response.json({ contract: 2, job: "99-002", items: [] })
  if (url.includes("/start/")) return Response.json({ agreement_id: "ag1", sign_url: "/sign/a/ag1" })
  return new Response("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } })
}) as typeof fetch

const load = () => import("./sign")

test("the twin asks as osc-staging-test on every call", async () => {
  const { neededForJob, startSigning, receipt } = await load()
  calls.length = 0
  assert.deepEqual(await neededForJob("99-002", SIGN_TWIN.slug, { email: SIGN_TWIN.email }), { ok: true, items: [] })
  assert.ok((await startSigning("99-002", SIGN_TWIN.slug, SIGN_TWIN.email, "i1")).ok)
  assert.ok(await receipt("ag1", SIGN_TWIN.slug, SIGN_TWIN.email))
  assert.deepEqual(calls.map((c) => c.headers["X-Sign-Org"]), ["osc-staging-test", "osc-staging-test", "osc-staging-test"])
  assert.equal(calls[0].headers["X-Sign-Viewer"], SIGN_TWIN.email)
})

test("on staging no other org asks (staging's engine holds no real books)", async () => {
  const { neededForJob, startSigning, receipt } = await load()
  calls.length = 0
  for (const slug of ["beech-acres", "rehearsal-osc", "demo-fernwood", `${SIGN_TWIN.slug}--preview`, SIGN_TWIN.signOrg]) {
    assert.equal(await neededForJob("26-015", slug, { email: "pat@beech.org" }), null, slug)
    assert.deepEqual(await startSigning("26-015", slug, "pat@beech.org", "i1"), { ok: false, reason: "unavailable" }, slug)
    assert.equal(await receipt("ag1", slug, "pat@beech.org"), null, slug)
  }
  assert.equal(calls.length, 0)
})

test("on staging a client sees their own sample only with SIGN_SHOW_SAMPLES=1", async () => {
  const { forClient } = await load()
  const sample = { id: "s", job: "99-002", kind: "client_agreement" as const, date: null, who: { name: "Client Test", email: SIGN_TWIN.email }, can_start: true, status: "missing" as const, agreement_id: null, signed_at: null, sample: true }
  delete process.env.SIGN_SHOW_SAMPLES
  assert.deepEqual(forClient([sample], { email: SIGN_TWIN.email }), [])
  process.env.SIGN_SHOW_SAMPLES = "1"
  assert.deepEqual(forClient([sample], { email: SIGN_TWIN.email }).map((s) => s.id), ["s"])
})
