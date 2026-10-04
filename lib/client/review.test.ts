// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/review.test.ts
// The Review reader (SPEC §13 v4) against a stubbed fetch: what each answer from Review becomes.
import { test } from "node:test"
import assert from "node:assert/strict"
import { REVIEW_API, REVIEW_WHY, reviewVersions, shareToken, versionStream } from "./review"

const A = "11111111-2222-4333-8444-555555555555"
const V1 = "aaaaaaaa-0000-4000-8000-000000000001"
const V2 = "aaaaaaaa-0000-4000-8000-000000000002"
const V3 = "aaaaaaaa-0000-4000-8000-000000000003"
let n = 0
const tok = () => `tok${String(++n).padStart(8, "0")}` // a fresh token per test: the 60 s cache never leaks between tests

function stub(answer: (url: string) => Response | Promise<Response>) {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    return answer(url)
  }) as typeof fetch
  return calls
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

test("shareToken takes only our Review share links", () => {
  assert.equal(shareToken("https://review.oliverstreetcreative.com/share/AbC123_-xyz"), "AbC123_-xyz")
  assert.equal(shareToken("https://review.oliverstreetcreative.com/share/AbC123_-xyz/"), "AbC123_-xyz")
  assert.equal(shareToken("https://f.io/o3rAC2XX"), null)
  assert.equal(shareToken("https://review.oliverstreetcreative.com/projects/abc12345"), null)
  assert.equal(shareToken("https://review.oliverstreetcreative.com.evil.com/share/AbC123_-xyz"), null)
  assert.equal(shareToken("http://review.oliverstreetcreative.com/share/AbC123_-xyz"), null)
  assert.equal(shareToken(null), null)
})

test("versions: ready ones only, newest first, Review's numbering", async () => {
  const t = tok()
  const calls = stub(() =>
    json([
      { id: V1, version_number: 1, processing_status: "ready", created_at: "2026-10-01T15:00:00Z" },
      { id: V3, version_number: 3, processing_status: "processing", created_at: "2026-10-03T15:00:00Z" },
      { id: V2, version_number: 2, processing_status: "ready", created_at: "2026-10-02T15:00:00Z" },
      { id: "not-a-uuid", version_number: 4, processing_status: "ready" },
    ]),
  )
  const r = await reviewVersions(t, A)
  assert.deepEqual(r, {
    ok: true,
    versions: [
      { id: V2, n: 2, posted_at: "2026-10-02T15:00:00Z" },
      { id: V1, n: 1, posted_at: "2026-10-01T15:00:00Z" },
    ],
  })
  assert.equal(calls[0], `${REVIEW_API}/share/${t}/assets/${A}/versions`)
})

test("versions: cached for a minute unless fresh", async () => {
  const t = tok()
  const calls = stub(() => json([{ id: V1, version_number: 1, processing_status: "ready" }]))
  await reviewVersions(t, A)
  await reviewVersions(t, A)
  assert.equal(calls.length, 1)
  await reviewVersions(t, A, { fresh: true })
  assert.equal(calls.length, 2)
})

test("versions: password/secure → locked, ended → gone, trouble → unreachable (and not cached)", async () => {
  stub(() => json({ detail: "password required" }, 401))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "locked" })
  stub(() => json({ detail: "forbidden" }, 403))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "locked" })
  stub(() => json({ detail: "not found" }, 404))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "gone" })
  stub(() => json({ detail: "expired" }, 410))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "gone" })
  stub(() => json([]))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "gone" })
  const t = tok()
  let calls = stub(() => json({ detail: "boom" }, 502))
  assert.deepEqual(await reviewVersions(t, A), { ok: false, why: "unreachable" })
  calls = stub(() => {
    throw new TypeError("fetch failed")
  })
  assert.deepEqual(await reviewVersions(t, A), { ok: false, why: "unreachable" })
  assert.equal(calls.length, 1, "an unreachable answer is retried, never cached")
})

test("versions: a bad asset id never reaches Review", async () => {
  const calls = stub(() => json([]))
  assert.deepEqual(await reviewVersions(tok(), "../../admin"), { ok: false, why: "gone" })
  assert.equal(calls.length, 0)
})

test("stream: Review's relative URL becomes absolute on the API; anything odd is refused", async () => {
  const t = tok()
  let calls = stub(() => json({ url: "/stream/hls/master.m3u8?token=abc" }))
  assert.equal(await versionStream(t, A, V2), `${REVIEW_API}/stream/hls/master.m3u8?token=abc`)
  assert.equal(calls[0], `${REVIEW_API}/share/${t}/stream/${A}?version_id=${V2}`)
  stub(() => json({ url: "https://cdn.example.com/x.m3u8" }))
  assert.equal(await versionStream(t, A, V2), "https://cdn.example.com/x.m3u8")
  stub(() => json({ url: "javascript:alert(1)" }))
  assert.equal(await versionStream(t, A, V2), null)
  stub(() => json({ detail: "no" }, 403))
  assert.equal(await versionStream(t, A, V2), null)
  calls = stub(() => json({ url: "/x" }))
  assert.equal(await versionStream(t, A, "nope"), null)
  assert.equal(calls.length, 0)
})

test("the client's words never promise what didn't happen", () => {
  assert.doesNotMatch(REVIEW_WHY.gone, /has been told/)
  for (const w of Object.values(REVIEW_WHY)) assert.ok(w.length < 90)
})
