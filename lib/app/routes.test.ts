// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/app/routes.test.ts
// osc-app's routing table (client-website SPEC §33).
import { test } from "node:test"
import assert from "node:assert/strict"
import { appRoute, originFrom } from "./routes"

test("everything Forms answered on portal.* stays with Forms", () => {
  for (const p of ["/portal", "/portal/login", "/portal/old", "/portal/p/kl_26-001", "/portal/auth/tok", "/hub", "/hub/login",
    "/hub/auth/tok", "/hub/view-as", "/hub-fonts/inter.woff2", "/day/26-023/2026-09-12", "/day/26-023/2026-09-12/sam/pdf",
    "/invoice/26-023", "/invoice/auth/tok", "/crew", "/crew/", "/crew/anything", "/static/hub.css", "/sw.js", "/healthz",
    "/start-a-project"]) {
    assert.equal(appRoute(p), "forms", p)
  }
})

test("the logged-in site is the app", () => {
  for (const p of ["/client", "/client/", "/client/projects/x", "/client/start/abc/project", "/login", "/magic", "/admin",
    "/admin/support/1", "/api/auth/code", "/api/scripts/x/render", "/calendar/tok.ics", "/support/signin-trouble",
    "/client-logos/acme.png", "/_next/static/x.js", "/favicon.ico"]) {
    assert.equal(appRoute(p), "app", p)
  }
})

test("the front door and everything public", () => {
  assert.equal(appRoute("/"), "root")
  for (const p of ["/work", "/work/phoenixs-story", "/for/ffb", "/faq", "/pricing", "/f/abc", "/village", "/casting",
    "/portalx", "/hubs", "/clientele", "/crewmember", "/day", "/invoice", "/staging-gate", "/demo/x", "/robots.txt", "/sitemap.xml"]) {
    assert.equal(appRoute(p), "public", p)
  }
})

test("origins come only as plain https origins", () => {
  assert.equal(originFrom("https://portal.oliverstreetcreative.com"), "https://portal.oliverstreetcreative.com")
  assert.equal(originFrom(" https://portal.oliverstreetcreative.com/ "), "https://portal.oliverstreetcreative.com")
  for (const bad of [undefined, null, "", "http://portal.oliverstreetcreative.com", "https://x.com/path", "https://x.com?q=1",
    "https://u:p@x.com", "portal.oliverstreetcreative.com", "javascript:alert(1)"]) {
    assert.equal(originFrom(bad as string), null, String(bad))
  }
})
