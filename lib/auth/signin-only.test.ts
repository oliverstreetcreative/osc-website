// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/auth/signin-only.test.ts
// Sam's test phase on production (SPEC §26 v3): only staff, crew and the listed client addresses get in.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mayMailClient, mayUseSite, signInOnly } from "./signin-only"

const ONLY = signInOnly(" Internal@OliverStreetCreative.com , ")
const client = (email: string) => ({ email, role: "CLIENT", is_staff: false })

test("off (unset or empty): everyone the books allow, as built", () => {
  assert.equal(signInOnly(undefined), null)
  assert.equal(signInOnly(""), null)
  assert.equal(signInOnly(" , "), null)
  assert.equal(mayUseSite(client("jane@beechacres.org"), null), true)
  assert.equal(mayMailClient("jane@beechacres.org", null), true)
})

test("on: a client signs in only from the list; staff and crew never change", () => {
  assert.deepEqual([...ONLY!], ["internal@oliverstreetcreative.com"])
  assert.equal(mayUseSite(client("internal@oliverstreetcreative.com"), ONLY), true)
  assert.equal(mayUseSite(client(" INTERNAL@oliverstreetcreative.com"), ONLY), true)
  assert.equal(mayUseSite(client("jane@beechacres.org"), ONLY), false)
  assert.equal(mayUseSite(client("sam+rehearsal@oliverstreetcreative.com"), ONLY), false) // an OSC address isn't a pass for a client
  assert.equal(mayUseSite({ email: "sam@oliverstreetcreative.com", role: "STAFF", is_staff: true }, ONLY), true)
  assert.equal(mayUseSite({ email: "x@y.org", role: "CLIENT", is_staff: true }, ONLY), true) // the staff flag wins
  assert.equal(mayUseSite({ email: "grip@gmail.com", role: "CREW", is_staff: false }, ONLY), true)
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
