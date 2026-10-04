// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/rehearsal.test.ts
// The rehearsal-client guards (SPEC §25 v2): which slugs, people, paths and ledgers count as rehearsal.
import { test } from "node:test"
import assert from "node:assert/strict"
import { SIGN_TWIN, bookPaths, isRehearsalPerson, isRehearsalSlug, ledgerDir, pathsOutside, rehearsalFolder, rehearsalTraces } from "./rehearsal"

test("only rehearsal- slugs are rehearsals", () => {
  assert.equal(isRehearsalSlug("rehearsal-osc"), true)
  assert.equal(isRehearsalSlug("rehearsal-osc--preview"), true)
  assert.equal(isRehearsalSlug("beech-acres"), false)
  assert.equal(isRehearsalSlug("demo-fernwood"), false)
  assert.equal(isRehearsalSlug(null), false)
})

test("rehearsal people are +rehearsal OSC addresses only", () => {
  assert.equal(isRehearsalPerson("sam+rehearsal@oliverstreetcreative.com"), true)
  assert.equal(isRehearsalPerson("SAM+Rehearsal@OliverStreetCreative.com "), true)
  assert.equal(isRehearsalPerson("sam+client-test@oliverstreetcreative.com"), false) // Harmon's suggester, Sign Here's tester
  assert.equal(isRehearsalPerson("sam@oliverstreetcreative.com"), false)
  assert.equal(isRehearsalPerson("jane+rehearsal@client.org"), false)
  assert.equal(isRehearsalPerson("sam+rehearsal@oliverstreetcreative.com.evil.com"), false)
})

test("Sign Here's test person is a rehearsal person ONLY in the signing twin's own book (SPEC §22 v2.1)", () => {
  assert.equal(SIGN_TWIN.slug, `rehearsal-${SIGN_TWIN.signOrg}`)
  assert.equal(isRehearsalSlug(SIGN_TWIN.slug), true)
  assert.equal(isRehearsalPerson(SIGN_TWIN.email, SIGN_TWIN.slug), true)
  assert.equal(isRehearsalPerson(" SAM+Client-Test@OliverStreetCreative.com", SIGN_TWIN.slug), true)
  assert.equal(isRehearsalPerson(SIGN_TWIN.email, "rehearsal-osc"), false) // never in any other rehearsal book
  assert.equal(isRehearsalPerson(SIGN_TWIN.email, SIGN_TWIN.signOrg), false) // nor under the engine's own name
  assert.equal(isRehearsalPerson("sam+client-test2@oliverstreetcreative.com", SIGN_TWIN.slug), false)
  assert.equal(isRehearsalPerson("jane@client.org", SIGN_TWIN.slug), false)
  assert.equal(isRehearsalPerson("sam+rehearsal-signing@oliverstreetcreative.com", SIGN_TWIN.slug), true) // the usual rule
})

test("a rehearsal's files sit plainly in its own folder (a preview uses its base slug's)", () => {
  assert.equal(rehearsalFolder("rehearsal-osc--preview"), "/_admin/client-site/rehearsal/files/rehearsal-osc/")
  const ok = "/_admin/client-site/rehearsal/files/rehearsal-osc/Proposal.pdf"
  assert.deepEqual(pathsOutside("rehearsal-osc", [ok]), [])
  const climb = "/_admin/client-site/rehearsal/files/rehearsal-osc/../../published/beech-acres.json"
  assert.deepEqual(pathsOutside("rehearsal-osc", [climb, "/Clients/Acme/x.pdf"]), [climb, "/Clients/Acme/x.pdf"])
})

test("every path a book names is found (documents, films, downloads, posters, invoices)", () => {
  const book = {
    projects: [{ poster: { path: "/a/poster.jpg" }, films: [{ file: "/a/film.mp4", poster: "/a/still.jpg", downloads: [{ label: "x", path: "/a/dl.mp4" }] }] }],
    invoices: [{ pdf: "/a/inv.pdf" }],
    documents: [{ path: "/a/doc.pdf" }],
  }
  assert.deepEqual(bookPaths(book).sort(), ["/a/dl.mp4", "/a/doc.pdf", "/a/film.mp4", "/a/inv.pdf", "/a/poster.jpg", "/a/still.jpg"])
})

test("a real book's rehearsal traces: a 99- job or a path into the rehearsal tree", () => {
  assert.deepEqual(rehearsalTraces({ projects: [{ job_number: "26-015" }], documents: [{ path: "/Clients/Acme/x.pdf" }] }), [])
  assert.deepEqual(rehearsalTraces({ projects: [{ job_number: "99-001" }] }), ["job 99-001"])
  assert.deepEqual(rehearsalTraces({ documents: [{ path: "/_admin/client-site/rehearsal/files/rehearsal-osc/x.pdf" }] }), [
    "/_admin/client-site/rehearsal/files/rehearsal-osc/x.pdf",
  ])
})

test("ledgers: real only for a real client in production; a rehearsal is always -staging", () => {
  assert.equal(ledgerDir("approvals", "beech-acres", true), "/_admin/client-site/ledger/approvals")
  assert.equal(ledgerDir("approvals", "beech-acres", false), "/_admin/client-site/ledger/approvals-staging")
  assert.equal(ledgerDir("acceptances", "rehearsal-osc", true), "/_admin/client-site/ledger/acceptances-staging")
  assert.equal(ledgerDir("flags", "rehearsal-osc--preview", true), "/_admin/client-site/ledger/flags-staging")
})
