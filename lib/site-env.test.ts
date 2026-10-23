// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/site-env.test.ts   (cwd = the repo)
// Which deployment am I (client-website SPEC §22 v2.1 review): an EMPTY SITE_ENV counts as unset, so Railway's own
// name decides; a non-empty SITE_ENV still overrides. Each case loads the module fresh in a child process.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"

const repo = process.cwd()

function deployment(env: Record<string, string>) {
  const clean: Record<string, string | undefined> = { ...process.env }
  delete clean.SITE_ENV
  delete clean.RAILWAY_ENVIRONMENT_NAME
  // Loaded through CommonJS interop the exports may sit under `default`.
  const code = `import(${JSON.stringify(path.join(repo, "lib", "site-env.ts"))}).then((m) => { const e = m.IS_STAGING === undefined ? m.default : m; process.stdout.write(JSON.stringify({ staging: e.IS_STAGING, production: e.IS_PRODUCTION })) })`
  const r = spawnSync(process.execPath, ["--conditions=import", "--import", path.join(repo, "node_modules", "tsx", "dist", "loader.mjs"), "-e", code], {
    env: { ...clean, ...env } as NodeJS.ProcessEnv,
    encoding: "utf8",
  })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

test("an empty SITE_ENV counts as unset: Railway's name decides", () => {
  assert.deepEqual(deployment({ SITE_ENV: "", RAILWAY_ENVIRONMENT_NAME: "production" }), { staging: false, production: true })
  assert.deepEqual(deployment({ SITE_ENV: "  ", RAILWAY_ENVIRONMENT_NAME: "staging" }), { staging: true, production: false })
  assert.deepEqual(deployment({ RAILWAY_ENVIRONMENT_NAME: " Production " }), { staging: false, production: true })
})

test("a non-empty SITE_ENV still overrides; nothing set is neither", () => {
  assert.deepEqual(deployment({ SITE_ENV: "staging", RAILWAY_ENVIRONMENT_NAME: "production" }), { staging: true, production: false })
  assert.deepEqual(deployment({ SITE_ENV: "local", RAILWAY_ENVIRONMENT_NAME: "production" }), { staging: false, production: false })
  assert.deepEqual(deployment({}), { staging: false, production: false })
})
