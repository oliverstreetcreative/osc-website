// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/orgs.test.ts
// SPEC §30 v2: a link or form names its org, accepted only when it's one of the person's own.
import { test } from "node:test"
import assert from "node:assert/strict"
import { memberOrg } from "./orgs"

test("an org named by a link or form counts only when it's one of the person's own", () => {
  const torres = { slug: "torres-consulting" }
  const beech = { slug: "beech-acres" }
  const ctx = { org: torres, orgs: [torres, beech] }
  assert.equal(memberOrg(ctx, null), torres) // nothing named: the selected org, as before
  assert.equal(memberOrg(ctx, undefined), torres)
  assert.equal(memberOrg(ctx, ""), torres)
  assert.equal(memberOrg(ctx, "beech-acres"), beech) // another of their own: that one
  assert.equal(memberOrg(ctx, "crestview-hills"), null) // not theirs: refuse, never fall back
  assert.equal(memberOrg(ctx, "Beech-Acres"), null) // slugs are exact
})
