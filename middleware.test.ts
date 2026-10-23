// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test middleware.test.ts
// #42: behind Railway's proxy Next sees the container's host (localhost:8080).
// The login return URL must use the public host the person asked for.
import { test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { redirectToLogin } from "./middleware"

function behindProxy(publicHost: string, path: string) {
  return new NextRequest(`http://localhost:8080${path}`, {
    headers: { host: "localhost:8080", "x-forwarded-host": publicHost },
  })
}

function returnUrl(req: NextRequest): string | null {
  const location = redirectToLogin(req).headers.get("location")
  assert.ok(location, "redirects")
  const url = new URL(location)
  assert.equal(url.origin, "https://login.oliverstreetcreative.com")
  assert.equal(url.pathname, "/login")
  return url.searchParams.get("redirect")
}

test("client.*: returns to the public host, not localhost:8080", () => {
  const req = behindProxy("client.oliverstreetcreative.com", "/projects")
  assert.equal(returnUrl(req), "https://client.oliverstreetcreative.com/projects")
})

test("crew.*: returns to the public host, keeping the query string", () => {
  const req = behindProxy("crew.oliverstreetcreative.com", "/?tab=calls")
  assert.equal(returnUrl(req), "https://crew.oliverstreetcreative.com/?tab=calls")
})

test("x-forwarded-host with several values: the first one wins", () => {
  const req = behindProxy("client.oliverstreetcreative.com, localhost:8080", "/projects")
  assert.equal(returnUrl(req), "https://client.oliverstreetcreative.com/projects")
})

test("no x-forwarded-host: falls back to the host header", () => {
  const req = new NextRequest("http://localhost:8080/projects", {
    headers: { host: "client.oliverstreetcreative.com" },
  })
  assert.equal(returnUrl(req), "https://client.oliverstreetcreative.com/projects")
})
