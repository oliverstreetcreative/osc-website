// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/app/routes.test.ts
// osc-app's routing table (client-website SPEC §33).
import { test } from "node:test"
import assert from "node:assert/strict"
import { appConfigProblem, appRoute, formsMaxBody, formsOriginFrom, originFrom } from "./routes"

test("the largest body passed to Forms: the old portal's own 100 MB limit there, 30 MB everywhere else", () => {
  const MB = 1024 * 1024
  assert.ok(formsMaxBody("/portal/p/kl_26-001/upload") >= 100 * MB + 64 * 1024)
  assert.ok(formsMaxBody("/portal") >= 100 * MB)
  assert.ok(formsMaxBody("/invoice/submit") >= 2 * 12_000_000 + 512 * 1024) // two 12 MB files and the form
  assert.ok(formsMaxBody("/invoice/submit") <= 32 * MB)
  assert.ok(formsMaxBody("/day/26-023/2026-09-12/tick") <= 32 * MB)
  assert.ok(formsMaxBody("/portalx") <= 32 * MB)
})

test("everything Forms answered on portal.* stays with Forms", () => {
  for (const p of ["/portal", "/portal/login", "/portal/old", "/portal/p/kl_26-001", "/portal/auth/tok", "/hub", "/hub/login",
    "/hub/auth/tok", "/hub/view-as", "/hub-fonts/inter.woff2", "/day/26-023/2026-09-12", "/day/26-023/2026-09-12/sam/pdf",
    "/invoice/26-023", "/invoice/auth/tok", "/crew", "/crew/", "/crew/anything", "/static/hub.css", "/sw.js", "/healthz",
    "/start-a-project"]) {
    assert.equal(appRoute(p), "forms", p)
  }
})

test("the logged-in site is the app, with only the APIs its pages call (v2)", () => {
  for (const p of ["/client", "/client/", "/client/projects/x", "/client/start/abc/project", "/login", "/magic", "/admin",
    "/admin/support/1", "/api/auth/code", "/api/scripts/x/render", "/api/admin/books", "/api/health", "/calendar/tok.ics",
    "/support/signin-trouble", "/client-logos/acme.png", "/_next/static/x.js", "/favicon.ico"]) {
    assert.equal(appRoute(p), "app", p)
  }
})

test("the front door and everything public, the public site's own APIs included", () => {
  assert.equal(appRoute("/"), "root")
  for (const p of ["/work", "/work/phoenixs-story", "/for/ffb", "/faq", "/pricing", "/f/abc", "/village", "/casting",
    "/portalx", "/hubs", "/clientele", "/crewmember", "/day", "/invoice", "/staging-gate", "/demo/x", "/robots.txt",
    "/sitemap.xml", "/quote-desk", "/api/intake", "/api/intake/x", "/api/estimate", "/api/quote-desk/unlock",
    "/api/prospect-logo/x", "/api/publish", "/api/staging/comment", "/api/portal/x", "/api/upload", "/api/crew/x",
    "/api/events", "/api/healthz", "/api/authx", "/openapi.json"]) {
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

test("Forms is reached only by its own Railway name, never one of ours (it would call itself once that name moves)", () => {
  assert.equal(formsOriginFrom("https://osc-forms-production.up.railway.app"), "https://osc-forms-production.up.railway.app")
  assert.equal(formsOriginFrom("https://localhost:8443"), "https://localhost:8443") // the local proxy tests
  for (const bad of ["https://portal.oliverstreetcreative.com", "https://hub.oliverstreetcreative.com",
    "https://forms.oliverstreetcreative.com", "http://osc-forms-production.up.railway.app", "https://up.railway.app.evil.com",
    "https://osc-forms-production.up.railway.app/x", ""]) {
    assert.equal(formsOriginFrom(bad), null, bad)
  }
})

test("osc-app refuses to start on a bad or missing origin, or off production; elsewhere nothing is checked", () => {
  const forms = "https://osc-forms-production.up.railway.app"
  const app = "https://portal.oliverstreetcreative.com"
  const prod = { SITE_ENV: "production" }
  assert.equal(appConfigProblem({}), null) // the public site, local
  assert.equal(appConfigProblem({ RAILWAY_ENVIRONMENT_NAME: "staging" }), null) // staging
  assert.equal(appConfigProblem({ APP_ORIGIN: "  " }), null)
  assert.equal(appConfigProblem({ ...prod, APP_ORIGIN: app, FORMS_ORIGIN: forms }), null)
  assert.equal(appConfigProblem({ RAILWAY_ENVIRONMENT_NAME: "production", APP_ORIGIN: app, FORMS_ORIGIN: forms }), null)
  assert.match(appConfigProblem({ ...prod, APP_ORIGIN: "portal.oliverstreetcreative.com", FORMS_ORIGIN: forms })!, /APP_ORIGIN/)
  assert.match(appConfigProblem({ ...prod, APP_ORIGIN: app })!, /FORMS_ORIGIN/)
  assert.match(appConfigProblem({ ...prod, APP_ORIGIN: app, FORMS_ORIGIN: "https://hub.oliverstreetcreative.com" })!, /FORMS_ORIGIN/)
  // a dropped APP_ORIGIN while the rest of osc-app's switches are there
  assert.match(appConfigProblem({ ...prod, FORMS_ORIGIN: forms })!, /APP_ORIGIN is missing/)
  assert.match(appConfigProblem({ ...prod, CLIENT_SITE_DB_PUSH: "1" })!, /APP_ORIGIN is missing/)
  // osc-app only as production: the fail-closed rules key on it
  assert.match(appConfigProblem({ APP_ORIGIN: app, FORMS_ORIGIN: forms })!, /production/)
  assert.match(appConfigProblem({ RAILWAY_ENVIRONMENT_NAME: "staging", APP_ORIGIN: app, FORMS_ORIGIN: forms })!, /production/)
  // localhost: the local tests only, never on Railway
  assert.equal(appConfigProblem({ ...prod, APP_ORIGIN: app, FORMS_ORIGIN: "https://localhost:8443" }), null)
  assert.match(appConfigProblem({ RAILWAY_ENVIRONMENT_NAME: "production", APP_ORIGIN: app, FORMS_ORIGIN: "https://localhost:8443" })!, /localhost/)
})
