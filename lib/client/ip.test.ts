// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/ip.test.ts
// The audit IP is the LAST X-Forwarded-For hop (the one Railway's edge appends), never what the browser claimed.
import { test } from "node:test"
import assert from "node:assert/strict"
import { clientIp } from "./ip"

const h = (o: Record<string, string>) => new Headers(o)

test("the last hop wins; a browser-supplied first hop is ignored", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 152.233.40.2" })), "152.233.40.2")
  assert.equal(clientIp(h({ "x-forwarded-for": " 152.233.40.2 " })), "152.233.40.2")
  assert.equal(clientIp(h({ "x-forwarded-for": "spoofed, , 87.249.134.7," })), "87.249.134.7")
})

test("no forwarded header: x-real-ip, else nothing", () => {
  assert.equal(clientIp(h({ "x-real-ip": " 10.0.0.1 " })), "10.0.0.1")
  assert.equal(clientIp(h({ "x-forwarded-for": "" })), null)
  assert.equal(clientIp(h({})), null)
})
