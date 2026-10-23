// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/auth/link-origin.test.ts
// Sign-in links land on the host the person will use (host-only cookies; SPEC §26 v2).
import { test } from "node:test"
import assert from "node:assert/strict"
import { APEX, CREW, magicLinkOrigin } from "./link-origin"

const login = "https://login.oliverstreetcreative.com"
const client = "https://client.oliverstreetcreative.com"

test("production: a client always signs in on the apex, wherever they asked from", () => {
  for (const from of [login, client, APEX]) assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: from, role: "CLIENT", isStaff: false }), APEX)
})

test("production: crew sign in on crew.*", () => {
  assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: login, role: "CREW", isStaff: false }), CREW)
})

test("production: staff sign in where they asked (the admin on login.*, View as client on the apex)", () => {
  assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: login, role: "STAFF", isStaff: true }), login)
  assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: APEX, role: "CLIENT", isStaff: true }), APEX)
})

test("production: a staff link never points at a host this app doesn't serve", () => {
  for (const from of ["https://blog.oliverstreetcreative.com", "https://review.oliverstreetcreative.com", "https://evil.example"])
    assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: from, role: "STAFF", isStaff: true }), APEX)
  assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: CREW, role: "STAFF", isStaff: true }), CREW)
})

test("osc-app: everyone signs in on the app's own host (portal.*, or its Railway name while it's checked)", () => {
  const portal = "https://portal.oliverstreetcreative.com"
  const railway = "https://osc-app-production.up.railway.app"
  const appOrigins = [portal, railway]
  for (const role of ["CLIENT", "CREW", "STAFF"]) {
    assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: portal, role, isStaff: role === "STAFF", appOrigins }), portal)
    assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: railway, role, isStaff: role === "STAFF", appOrigins }), railway)
    assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: APEX, role, isStaff: role === "STAFF", appOrigins }), portal)
    assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: "https://evil.example", role, isStaff: false, appOrigins }), portal)
  }
  // an empty list is the site as built
  assert.equal(magicLinkOrigin({ isProduction: true, requestOrigin: login, role: "CLIENT", isStaff: false, appOrigins: [] }), APEX)
})

test("staging and local keep the host they asked from", () => {
  const staging = "https://osc-website-staging.up.railway.app"
  assert.equal(magicLinkOrigin({ isProduction: false, requestOrigin: staging, role: "CLIENT", isStaff: false }), staging)
  assert.equal(magicLinkOrigin({ isProduction: false, requestOrigin: staging, role: "CREW", isStaff: false }), staging)
})
