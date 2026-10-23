// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/review.test.ts
// The Review reader (SPEC §13 v4) against a stubbed fetch: what each answer from Review becomes. The status codes and
// `detail` texts are FreeFrame's own (services/permissions.py, routers/share.py; checked 10/3 20:50).
import { test } from "node:test"
import assert from "node:assert/strict"
import { REVIEW_API, REVIEW_WHY, reviewVersions, shareToken, versionStream } from "./review"

const A = "11111111-2222-4333-8444-555555555555"
const V1 = "aaaaaaaa-0000-4000-8000-000000000001"
const V2 = "aaaaaaaa-0000-4000-8000-000000000002"
const V3 = "aaaaaaaa-0000-4000-8000-000000000003"
let n = 0
const tok = () => `tok${String(++n).padStart(8, "0")}` // a fresh token per case: the cache never leaks between cases

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
const refusal = (status: number, detail: string) => json({ detail }, status)

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

test("versions: ONLY a password or a login requirement is 'locked'", async () => {
  stub(() => refusal(403, "Password required"))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "locked" })
  stub(() => refusal(403, "Authentication required for this link's visibility setting"))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "locked" })
  stub(() => refusal(401, "Password required"))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "locked" })
})

test("versions: a disabled link, a wrong asset id, an expired or missing link are 'gone' (never 'locked')", async () => {
  for (const [status, detail] of [
    [403, "Share link is disabled"],
    [403, "Asset does not match share link"],
    [403, "Asset is not within the shared folder"],
    [403, ""],
    [404, "Share link not found"],
    [404, "Asset not found"],
    [410, "Share link has expired"],
    [400, "Invalid share link"],
    [422, "value is not a valid uuid"],
  ] as const) {
    stub(() => refusal(status, detail))
    assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "gone" }, `${status} ${detail}`)
  }
})

test("versions: no ready version yet is 'processing' (a first cut still transcoding), not an ended link", async () => {
  stub(() => json([]))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "processing" })
  stub(() => json([{ id: V1, version_number: 1, processing_status: "processing" }]))
  assert.deepEqual(await reviewVersions(tok(), A), { ok: false, why: "processing" })
})

test("versions: trouble is 'unreachable', cached briefly (15 s), and `fresh` always asks again", async () => {
  const t = tok()
  let calls = stub(() => json({ detail: "boom" }, 502))
  assert.deepEqual(await reviewVersions(t, A), { ok: false, why: "unreachable" })
  calls = stub(() => {
    throw new TypeError("fetch failed")
  })
  assert.deepEqual(await reviewVersions(t, A), { ok: false, why: "unreachable" })
  assert.equal(calls.length, 0, "a hung Review isn't asked again on every render")
  calls = stub(() => json([{ id: V1, version_number: 1, processing_status: "ready" }]))
  assert.equal((await reviewVersions(t, A, { fresh: true })).ok, true)
  assert.equal(calls.length, 1)
})

test("versions: a bad asset id never reaches Review", async () => {
  const calls = stub(() => json([]))
  assert.deepEqual(await reviewVersions(tok(), "../../admin"), { ok: false, why: "gone" })
  assert.equal(calls.length, 0)
})

test("stream: only the version asked for counts (Review serves its latest when it can't serve that one)", async () => {
  const t = tok()
  let calls = stub(() => json({ url: "/stream/hls/master.m3u8?token=abc", version_id: V2 }))
  assert.equal(await versionStream(t, A, V2), `${REVIEW_API}/stream/hls/master.m3u8?token=abc`)
  assert.equal(calls[0], `${REVIEW_API}/share/${t}/stream/${A}?version_id=${V2}`)
  stub(() => json({ url: "/stream/hls/master.m3u8?token=abc", version_id: V3 }))
  assert.equal(await versionStream(t, A, V2), null, "a different version is refused")
  stub(() => json({ url: "/stream/hls/master.m3u8?token=abc" }))
  assert.equal(await versionStream(t, A, V2), null, "no version named is refused")
  stub(() => json({ url: "https://cdn.example.com/x.m3u8", version_id: V2 }))
  assert.equal(await versionStream(t, A, V2), "https://cdn.example.com/x.m3u8")
  stub(() => json({ url: "javascript:alert(1)", version_id: V2 }))
  assert.equal(await versionStream(t, A, V2), null)
  stub(() => refusal(403, "Password required"))
  assert.equal(await versionStream(t, A, V2), null)
  calls = stub(() => json({ url: "/x", version_id: V2 }))
  assert.equal(await versionStream(t, A, "nope"), null)
  assert.equal(calls.length, 0)
})

test("the client's words never promise what didn't happen", () => {
  assert.doesNotMatch(Object.values(REVIEW_WHY).join(" "), /has been told|we've let|we told/i)
  for (const w of Object.values(REVIEW_WHY)) assert.ok(w.length < 90)
})
