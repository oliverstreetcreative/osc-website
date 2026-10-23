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

function loginRedirect(req: NextRequest): URL {
  const location = redirectToLogin(req).headers.get("location")
  assert.ok(location, "redirects")
  return new URL(location)
}

test("client.*: returns to the public host, not localhost:8080", () => {
  const url = loginRedirect(behindProxy("client.oliverstreetcreative.com", "/projects?tab=open"))
  assert.equal(url.origin, "https://login.oliverstreetcreative.com")
  assert.equal(url.pathname, "/login")
  assert.equal(url.searchParams.get("redirect"), "https://client.oliverstreetcreative.com/projects?tab=open")
})

test("x-forwarded-host with several values: the first one wins", () => {
  const url = loginRedirect(behindProxy("client.oliverstreetcreative.com, localhost:8080", "/projects"))
  assert.equal(url.searchParams.get("redirect"), "https://client.oliverstreetcreative.com/projects")
})

test("crew.*: signs in on crew.* itself, with a path-only return (never localhost:8080)", () => {
  const url = loginRedirect(behindProxy("crew.oliverstreetcreative.com", "/projects"))
  assert.equal(url.pathname, "/login")
  assert.equal(url.searchParams.get("redirect"), "/crew/projects")
})
