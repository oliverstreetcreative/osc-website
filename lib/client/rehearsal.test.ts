// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/rehearsal.test.ts
// The rehearsal-client guards (SPEC §25 v2): which slugs, people and folders count as rehearsal.
import { test } from "node:test"
import assert from "node:assert/strict"
import { isRehearsalPerson, isRehearsalSlug, rehearsalFolder } from "./rehearsal"

test("only rehearsal- slugs are rehearsals", () => {
  assert.equal(isRehearsalSlug("rehearsal-osc"), true)
  assert.equal(isRehearsalSlug("rehearsal-osc--preview"), true)
  assert.equal(isRehearsalSlug("beech-acres"), false)
  assert.equal(isRehearsalSlug("demo-fernwood"), false)
  assert.equal(isRehearsalSlug(null), false)
})

test("rehearsal people are OSC plus-addresses only", () => {
  assert.equal(isRehearsalPerson("sam+rehearsal@oliverstreetcreative.com"), true)
  assert.equal(isRehearsalPerson("SAM+Rehearsal@OliverStreetCreative.com "), true)
  assert.equal(isRehearsalPerson("sam@oliverstreetcreative.com"), false) // Sam's real address: not a test identity
  assert.equal(isRehearsalPerson("jane+test@client.org"), false)
  assert.equal(isRehearsalPerson("sam+x@oliverstreetcreative.com.evil.com"), false)
})

test("a rehearsal's files sit in its own folder (a preview uses its base slug's)", () => {
  assert.equal(rehearsalFolder("rehearsal-osc"), "/_admin/client-site/rehearsal/files/rehearsal-osc/")
  assert.equal(rehearsalFolder("rehearsal-osc--preview"), "/_admin/client-site/rehearsal/files/rehearsal-osc/")
})
