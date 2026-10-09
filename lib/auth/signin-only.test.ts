// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/auth/signin-only.test.ts
// Sam's test phase (SPEC §26 v3, §33): only staff, crew and the listed client addresses get in, and only staff and the
// listed addresses see client pages.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mayMailClient, mayUseSite, mayViewClientSite, signInOnly } from "./signin-only"

const ONLY = signInOnly(" Internal@OliverStreetCreative.com , ")
const client = (email: string) => ({ email, role: "CLIENT", is_staff: false })

test("off when UNSET off production (staging, local): the site as built", () => {
  assert.equal(signInOnly(undefined, false), null)
  assert.equal(mayUseSite(client("jane@beechacres.org"), null), true)
  assert.equal(mayViewClientSite(client("jane@beechacres.org"), null), true)
  assert.equal(mayMailClient("jane@beechacres.org", null), true)
})

test("PRODUCTION fails closed when UNSET: no client, no client mail; staff and crew still sign in (§33 v2)", () => {
  const none = signInOnly(undefined, true)
  assert.ok(none && none.size === 0)
  assert.equal(mayUseSite(client("jane@beechacres.org"), none), false)
  assert.equal(mayUseSite(client("internal@oliverstreetcreative.com"), none), false)
  assert.equal(mayViewClientSite(client("jane@beechacres.org"), none), false)
  assert.equal(mayMailClient("jane@beechacres.org", none), false)
  assert.equal(mayUseSite({ email: "sam@oliverstreetcreative.com", role: "STAFF", is_staff: true }, none), true)
  assert.equal(mayUseSite({ email: "grip@gmail.com", role: "CREW", is_staff: false }, none), true)
})

test("only an explicit `off` opens it, on production or anywhere", () => {
  for (const raw of ["off", " OFF ", "Off"]) {
    assert.equal(signInOnly(raw, true), null, raw)
    assert.equal(signInOnly(raw, false), null, raw)
  }
  assert.deepEqual([...signInOnly("off@oliverstreetcreative.com", true)!], ["off@oliverstreetcreative.com"]) // an address, not the word
})

test("set but listing nobody FAILS CLOSED: no client at all (20:10 review)", () => {
  for (const raw of ["", " ", ",", " , "]) {
    const none = signInOnly(raw, false)
    assert.ok(none && none.size === 0, JSON.stringify(raw))
    assert.equal(mayUseSite(client("internal@oliverstreetcreative.com"), none), false)
    assert.equal(mayViewClientSite(client("jane@beechacres.org"), none), false)
    assert.equal(mayMailClient("jane@beechacres.org", none), false)
    assert.equal(mayUseSite({ email: "sam@oliverstreetcreative.com", role: "STAFF", is_staff: true }, none), true)
  }
})

test("on: a client signs in only from the list; staff and crew can always sign in", () => {
  assert.deepEqual([...ONLY!], ["internal@oliverstreetcreative.com"])
  assert.equal(mayUseSite(client("internal@oliverstreetcreative.com"), ONLY), true)
  assert.equal(mayUseSite(client(" INTERNAL@oliverstreetcreative.com"), ONLY), true)
  assert.equal(mayUseSite(client("jane@beechacres.org"), ONLY), false)
  assert.equal(mayUseSite(client("sam+rehearsal@oliverstreetcreative.com"), ONLY), false) // an OSC address isn't a pass for a client
  assert.equal(mayUseSite({ email: "sam@oliverstreetcreative.com", role: "STAFF", is_staff: true }, ONLY), true)
  assert.equal(mayUseSite({ email: "x@y.org", role: "CLIENT", is_staff: true }, ONLY), true) // the staff flag wins
  assert.equal(mayUseSite({ email: "grip@gmail.com", role: "CREW", is_staff: false }, ONLY), true)
})

test("on: only staff and the listed addresses see client pages; a crew contact in a client's book doesn't", () => {
  assert.equal(mayViewClientSite({ email: "grip@gmail.com", role: "CREW", is_staff: false }, ONLY), false)
  assert.equal(mayViewClientSite(client("jane@beechacres.org"), ONLY), false)
  assert.equal(mayViewClientSite(client("internal@oliverstreetcreative.com"), ONLY), true)
  assert.equal(mayViewClientSite({ email: "sam@oliverstreetcreative.com", role: "STAFF", is_staff: true }, ONLY), true)
  assert.equal(mayViewClientSite({ email: "sam@oliverstreetcreative.com", is_staff: true }, ONLY), true)
})

test("on: client mail goes only to OSC addresses and the list", () => {
  assert.equal(mayMailClient("jane@beechacres.org", ONLY), false)
  assert.equal(mayMailClient("internal@oliverstreetcreative.com", ONLY), true)
  assert.equal(mayMailClient("sam@oliverstreetcreative.com", ONLY), true)
})

test("the switch is read from the environment on every call", () => {
  const was = process.env.CLIENT_SIGNIN_ONLY
  try {
    process.env.CLIENT_SIGNIN_ONLY = "internal@oliverstreetcreative.com"
    assert.equal(mayUseSite(client("jane@beechacres.org")), false)
    delete process.env.CLIENT_SIGNIN_ONLY
    assert.equal(mayUseSite(client("jane@beechacres.org")), true)
  } finally {
    if (was === undefined) delete process.env.CLIENT_SIGNIN_ONLY
    else process.env.CLIENT_SIGNIN_ONLY = was
  }
})
