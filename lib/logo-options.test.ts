// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/logo-options.test.ts   (cwd = the repo)
// The staging header-logo switcher (website-redesign SPEC Feature 6; Sam 10/8 ~14:55): every option the script accepts
// has its CSS, the default is d83, and option D's sizes are the ratios Sam was shown.
import { test } from "node:test"
import assert from "node:assert/strict"
import { CAPS_PX, CAP_EM, D_RATIOS, D_SIZES, LOBSTER_BODY_EM, LOGO_DEFAULT, LOGO_OPTIONS, LOGO_SCRIPT, logoCss } from "./logo-options"

const KEYS = LOGO_OPTIONS.map((o) => o.key)

test("the options are the ones on Sam's page, default d83 (Majordomo's brief)", () => {
  assert.deepEqual(KEYS, ["a", "b", "c", "d76", "d83", "d90", "now"])
  assert.equal(LOGO_DEFAULT, "d83")
})

test("every key the script accepts has its show / label / lit rules, and no-JS shows the default", () => {
  const css = logoCss()
  for (const k of KEYS) {
    assert.ok(css.includes(`html[data-logo="${k}"] .site-logo-opt[data-opt="${k}"]{display:flex}`), `show ${k}`)
    assert.ok(css.includes(`html[data-logo="${k}"] .site-logo-cur[data-opt="${k}"]{display:inline}`), `label ${k}`)
    assert.ok(css.includes(`html[data-logo="${k}"] .site-logo-switch a[data-opt="${k}"]`), `lit ${k}`)
  }
  assert.ok(css.includes(`html:not([data-logo]) .site-logo-opt[data-opt="${LOGO_DEFAULT}"]{display:flex}`))
  for (const k of KEYS) assert.ok(LOGO_SCRIPT.includes(`"${k}"`), `script accepts ${k}`)
  assert.ok(LOGO_SCRIPT.includes(`d="${LOGO_DEFAULT}"`))
})

test("option D: 'reative' stands at 76/83/90% of the caps' height (today ~68%)", () => {
  const capPx = CAPS_PX * CAP_EM
  for (const [k, ratio] of Object.entries(D_RATIOS) as [keyof typeof D_RATIOS, number][]) {
    const body = D_SIZES[k] * LOBSTER_BODY_EM
    assert.ok(Math.abs(body / capPx - ratio) < 0.005, `${k}: ${(body / capPx).toFixed(3)} vs ${ratio}`)
  }
  const today = (18 * LOBSTER_BODY_EM) / capPx
  assert.ok(today > 0.67 && today < 0.69, `today's ratio ${today.toFixed(3)}`)
})
