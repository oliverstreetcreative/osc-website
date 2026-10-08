// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/staging/comment.test.ts
// Staging's Comment button (client-website SPEC §32 v2): what a comment keeps and where it's filed.
import { test } from "node:test"
import assert from "node:assert/strict"
import { COMMENT_FORMAT, NOTE_MAX, commentFile, commentRecord, deviceWords, localStamp, parseComment, scrubSecrets } from "./comment"

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

test("a note, its page, its title and the viewport are kept; the rest is refused or dropped", () => {
  const r = parseComment({ note: "  The button\r\nis too low.  ", path: "/client/start/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/project?x=1", title: "Start a project", viewport: { w: 390, h: 844, dpr: 3 }, extra: "x" })
  assert.ok(r.ok)
  assert.deepEqual(r.value, { note: "The button\nis too low.", path: "/client/start/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/project?x=1", title: "Start a project", viewport: { w: 390, h: 844, dpr: 3 } })
  assert.equal(parseComment({ note: "   ", path: "/" }).ok, false)
  assert.equal(parseComment({ note: 42, path: "/" }).ok, false)
  assert.equal(parseComment({ note: "x", path: "https://evil.example/" }).ok, false)
  assert.equal(parseComment({ note: "x", path: "//evil.example/" }).ok, false)
  assert.equal(parseComment({ note: "x" }).ok, false)
  const odd = parseComment({ note: "x", path: "/", viewport: { w: "390", h: 1e9, dpr: NaN } })
  assert.ok(odd.ok)
  assert.equal(odd.value.viewport, null)
  const long = parseComment({ note: "a".repeat(NOTE_MAX + 50), path: "/" })
  assert.ok(long.ok)
  assert.equal(long.value.note.length, NOTE_MAX)
  const lines = parseComment({ note: "x", path: "/a\nb", title: "T\u0000i\ttle\n" })
  assert.ok(lines.ok)
  assert.equal(lines.value.path, "/a b")
  assert.equal(lines.value.title, "Ti tle")
})

test("secrets never reach the file: sign-in tokens, private links, JWTs", () => {
  assert.equal(scrubSecrets("/magic?token=abc123&next=/client"), "/magic?token=[redacted]&next=/client")
  assert.equal(scrubSecrets("/calendar/9f86d081884c7d659a2feaa0c55ad015"), "/calendar/[redacted]")
  assert.equal(scrubSecrets("/client/scripts/invite/AbC123?x=1"), "/client/scripts/invite/[redacted]?x=1")
  assert.equal(scrubSecrets("/demo/secret-demo-token"), "/demo/[redacted]")
  assert.equal(scrubSecrets("/api/auth/preview?key=k&as=a@b.c"), "/api/auth/preview?key=[redacted]&as=a@b.c")
  assert.equal(scrubSecrets("see eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl now"), "see [redacted-jwt] now")
  // percent-encoded inside another link's query (built review 10/8)
  assert.equal(scrubSecrets("/login?redirect=%2Fclient%2Fscripts%2Finvite%2FAbC123%3Fx%3D1"), "/login?redirect=%2Fclient%2Fscripts%2Finvite%2F[redacted]%3Fx%3D1")
  assert.equal(scrubSecrets("/login?redirect=%2fcalendar%2f9f86d081.ics"), "/login?redirect=%2fcalendar%2f[redacted]")
  assert.equal(scrubSecrets("/login?redirect=%2Fmagic%3Ftoken%3Dabc123%26next%3D%2Fclient"), "/login?redirect=%2Fmagic%3Ftoken%3D[redacted]%26next%3D%2Fclient")
  // ids aren't secrets: the page Sam meant stays findable
  assert.equal(scrubSecrets("/client/projects/harmon-sos/approve/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"), "/client/projects/harmon-sos/approve/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")
  const r = parseComment({ note: "this link failed: https://x/magic?token=abc", path: "/magic?token=abc" })
  assert.ok(r.ok)
  assert.equal(r.value.path, "/magic?token=[redacted]")
  assert.equal(r.value.note, "this link failed: https://x/magic?token=[redacted]")
})

test("devices in plain words", () => {
  assert.equal(deviceWords(IPHONE), "iPhone · Safari")
  assert.equal(deviceWords(MAC_CHROME), "Mac · Chrome")
  assert.equal(deviceWords(""), "unknown device · another browser")
})

test("filed by Eastern day and time, never colliding within a second", () => {
  const at = new Date("2026-10-08T18:02:09.500Z") // 14:02:09 EDT
  assert.equal(localStamp(at), "10/8 14:02")
  assert.equal(commentFile(at, "abcdef12-3456-7890-abcd-ef1234567890"), "/_admin/staging-comments/2026-10-08/140209_abcdef12.json")
  // after midnight UTC but still the 8th in Cincinnati
  assert.equal(commentFile(new Date("2026-10-09T02:30:00Z"), "00000000-x"), "/_admin/staging-comments/2026-10-08/223000_00000000.json")
})

test("the record: verified facts from the server, the browser's words as data", () => {
  const at = new Date("2026-10-08T18:02:09Z")
  const rec = commentRecord(
    { note: "Too low.", path: "/client", title: "Home", viewport: { w: 390, h: 844, dpr: 3 } },
    { id: "id-1", at, host: "osc-website-staging.up.railway.app", ua: IPHONE, build: "3102c08abc", who: { name: "Sam Patton", email: "sam@oliverstreetcreative.com", staff: true }, viewingAs: "Rehearsal Client" },
  )
  assert.deepEqual(rec, {
    format: COMMENT_FORMAT, id: "id-1", at: "2026-10-08T18:02:09.000Z", at_local: "10/8 14:02", host: "osc-website-staging.up.railway.app",
    path: "/client", title: "Home", note: "Too low.", viewport: { w: 390, h: 844, dpr: 3 }, device: "iPhone · Safari", build: "3102c08abc",
    who: { name: "Sam Patton", email: "sam@oliverstreetcreative.com", staff: true }, viewing_as: "Rehearsal Client",
  })
  const anon = commentRecord({ note: "x", path: "/", title: "", viewport: null }, { id: "id-2", at, host: "h", ua: null, build: null, who: null, viewingAs: null })
  assert.equal(anon.who, null)
  assert.equal(anon.build, null)
})
