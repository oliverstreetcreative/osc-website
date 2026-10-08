// node --conditions=import --import ./node_modules/tsx/dist/loader.mjs --test lib/client/request-form.test.ts
// Start a project v3 (SPEC §31 v2): the v5 questions, saved as she goes, read back the old form's way.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  LONG, SCREENS, STEPS, allProblems, clientTypedFields, nextStep, parseScreen, prevStep, queueData, requestTitle, rowOp,
  screenProblems, storedName, summary, type Answers, type Posted, type StoredFile,
} from "./request-form"

const post = (pairs: [string, string][]): Posted => ({
  get: (n) => pairs.find(([k]) => k === n)?.[1] ?? null,
  getAll: (n) => pairs.filter(([k]) => k === n).map(([, v]) => v),
})

test("the screens are v5's, in order, with Sam's six changes", () => {
  assert.deepEqual([...STEPS], ["about", "project", "timing", "money", "assets", "creative", "rights", "else"])
  const about = SCREENS.about.fields.map((f) => f.label)
  assert.ok(about.includes("The brand's website")) // #1
  assert.ok(SCREENS.assets.fields.some((f) => f.label === "I'll send these later")) // #2
  assert.match(SCREENS.rights.intro ?? "", /license from OSC to use the finished video is perpetual/) // #3
  assert.ok(SCREENS.rights.fields.some((f) => f.name === "social_handles" && f.type === "rows")) // #4
  assert.ok(SCREENS.rights.fields.some((f) => f.name === "osc_may_post_piece")) // #5
  assert.ok(SCREENS.rights.fields.some((f) => f.name === "osc_may_post_bts"))
  assert.equal(SCREENS.else.fields[0].label, "Anything else?") // #6
  assert.equal(SCREENS.else.fields[0].help, undefined)
  assert.equal(nextStep("else"), "review")
  assert.equal(prevStep("about"), "about")
})

test("a save keeps every word: cleaned, never cut at the limit, flagged instead", () => {
  const long = "x".repeat(LONG + 50)
  const v = parseScreen("project", post([["project_summary", `  A pitch‮ with a bidi override.\u0007 ${long}`], ["deliverables.count", "1"], ["deliverables.0.item", "Social cutdown"]]))
  assert.ok(typeof v.project_summary === "string" && v.project_summary.length > LONG) // kept
  assert.ok(!String(v.project_summary).includes("‮") && !String(v.project_summary).includes("\u0007"))
  assert.match(screenProblems("project", v).project_summary ?? "", /over 2,000 characters/)
})

test("rows: add and remove are buttons that save; at least one deliverable row; v5's values only", () => {
  assert.deepEqual(rowOp("add:deliverables"), { kind: "add", field: "deliverables", index: -1 })
  assert.deepEqual(rowOp("remove:social_handles:3"), { kind: "remove", field: "social_handles", index: 3 })
  assert.equal(rowOp("remove:deliverables"), null)
  assert.equal(rowOp("drop table"), null)
  const base: [string, string][] = [
    ["deliverables.count", "2"],
    ["deliverables.0.item", "TV / broadcast spot"],
    ["deliverables.0.qty", "2"],
    ["deliverables.0.aspect", "16:9"],
    ["deliverables.0.aspect", "9:16"],
    ["deliverables.0.aspect", "3:2"], // not v5's: dropped
    ["deliverables.1.item", "other"],
    ["deliverables.1.item_other", "A podcast intro"],
  ]
  const added = parseScreen("project", post(base), "add:deliverables")
  assert.equal((added.deliverables as unknown[]).length, 3)
  const removed = parseScreen("project", post(base), "remove:deliverables:0")
  assert.equal((removed.deliverables as { item: string }[])[0].item, "other")
  const plain = parseScreen("project", post(base))
  assert.deepEqual((plain.deliverables as { aspect: string[] }[])[0].aspect, ["16:9", "9:16"])
  // Removing the only row leaves one empty row (at least one), and a made-up value is dropped.
  const one = parseScreen("project", post([["deliverables.count", "1"], ["deliverables.0.item", "A spaceship"]]), "remove:deliverables:0")
  assert.equal((one.deliverables as { item: string }[]).length, 1)
  assert.equal((one.deliverables as { item: string }[])[0].item, "")
  assert.match(screenProblems("project", one).deliverables ?? "", /at least one/)
  // "Something else…" needs its words.
  const other = parseScreen("project", post([["project_summary", "x"], ["deliverables.count", "1"], ["deliverables.0.item", "other"]]))
  assert.equal(screenProblems("project", other)["deliverables.0.item_other"], "Say what it is.")
})

test("no shoot: the shoot questions are dropped; no posting yes: no approve-first", () => {
  const t = parseScreen("timing", post([["has_shoot", "none"], ["shoot_location", "The studio"], ["delivery_deadline", "Nov 15"]]))
  assert.equal(t.shoot_location, "")
  assert.equal(t.delivery_deadline, "Nov 15")
  const r = parseScreen("rights", post([["osc_may_post_piece", "no"], ["osc_post_approval", "on"]]))
  assert.equal(r.osc_post_approval, false)
  const r2 = parseScreen("rights", post([["osc_may_post_bts", "yes"], ["osc_post_approval", "on"]]))
  assert.equal(r2.osc_post_approval, true)
})

test("brand assets: a file, or 'I'll send these later'", () => {
  assert.match(screenProblems("assets", parseScreen("assets", post([]))).brand_assets ?? "", /Upload at least one file/)
  assert.deepEqual(screenProblems("assets", parseScreen("assets", post([["brand_assets_later", "on"]]))), {})
  assert.deepEqual(screenProblems("assets", {}, { files: 1 }), {})
})

test("Send's check finds the first screen that's missing something", () => {
  const answers: Answers = { project: parseScreen("project", post([["project_summary", "A landing video."], ["deliverables.count", "1"], ["deliverables.0.item", "Social cutdown"]])) }
  const missing = allProblems(answers, 0)
  assert.deepEqual(missing.map((m) => m.step), ["assets"])
  assert.deepEqual(allProblems({ ...answers, assets: { brand_assets_later: true } }, 0), [])
})

test("the card's title: the pitch's first sentence, cut at a word, never money", () => {
  const a = (s: string): Answers => ({ project: { project_summary: s } })
  assert.equal(requestTitle(a("A landing video for our studio. It should feel warm.")), "A landing video for our studio")
  assert.equal(requestTitle(a("We need a $20k campaign spot for the fall.")), "Your project request")
  assert.equal(requestTitle(a("Budget is 15k for three spots.")), "Your project request")
  assert.equal(requestTitle(a("")), "Your project request")
  const long = requestTitle(a("A long pitch about a documentary following three generations of a family farm in rural Kentucky"))
  assert.ok(long.endsWith("…") && long.length <= 71, long)
  assert.ok(!long.includes("  "))
})

test("the queue's data speaks v5: its own keys, other + item-Comment, booleans, files as {name, type, content}", () => {
  const answers: Answers = {
    about: { submitter_phone: "859-555-1212", submitter_role: "", company_website: "oliverstreetcreative.com" },
    project: parseScreen("project", post([
      ["project_summary", "A landing video."], ["project_type", "corporate"],
      ["deliverables.count", "2"], ["deliverables.0.item", "Social cutdown"], ["deliverables.0.qty", "3"],
      ["deliverables.1.item", "other"], ["deliverables.1.item_other", "A podcast intro"],
    ])),
    timing: parseScreen("timing", post([["has_shoot", "none"], ["shoot_location", "Studio"], ["delivery_deadline", "Nov 15"]])),
    assets: { brand_assets_later: false },
    rights: parseScreen("rights", post([["osc_may_post_piece", "yes"], ["osc_may_post_bts", "no"], ["osc_post_approval", "on"],
      ["social_handles.count", "1"], ["social_handles.0.platform", "Instagram"], ["social_handles.0.handle", "@osc"]])),
  }
  const files: StoredFile[] = [
    { n: 1, name: "Logo.svg", stored: "01_logo.svg", type: "image/svg+xml", size: 10, path: "/_admin/intake-queue/_staging-assets/r/01_logo.svg", at: "2026-10-08T15:00:00Z" },
    { n: 2, name: "old.png", stored: "02_old.png", type: "image/png", size: 10, path: "/x/02_old.png", at: "2026-10-08T15:00:00Z", removed_at: "2026-10-08T15:01:00Z" },
  ]
  const d = queueData(answers, { name: "Sam Patton", company: "OSC Internal Videos", email: "internal@oliverstreetcreative.com" }, files)
  assert.equal(d.submitter_name, "Sam Patton")
  assert.equal(d.submitter_company, "OSC Internal Videos")
  assert.equal(d.company_website, "oliverstreetcreative.com")
  assert.equal(d.submitter_role, undefined) // blank answers are left out, as the old form leaves them out
  assert.deepEqual(d.deliverables, [{ item: "Social cutdown", qty: 3 }, { item: "other", qty: 1, "item-Comment": "A podcast intro" }])
  assert.equal(d.has_shoot, "none")
  assert.equal(d.shoot_location, undefined)
  assert.deepEqual(d.brand_assets, [{ name: "Logo.svg", type: "image/svg+xml", content: "/_admin/intake-queue/_staging-assets/r/01_logo.svg" }])
  assert.equal(d.brand_assets_later, false)
  assert.equal(d.osc_may_post_piece, true)
  assert.equal(d.osc_may_post_bts, false)
  assert.equal(d.osc_post_approval, true)
  assert.deepEqual(d.social_handles, [{ platform: "Instagram", handle: "@osc" }])
  const typed = clientTypedFields(d)
  for (const k of ["data.project_summary", "data.company_website", "data.deliverables[1].item-Comment", "data.social_handles[0].handle", "data.brand_assets[0].name"]) {
    assert.ok(typed.includes(k), k)
  }
  assert.ok(!typed.includes("data.project_type")) // a button, not her words
})

test("the summary hides money from people who don't see it, and names files only", () => {
  const answers: Answers = { money: { budget_range: "5-15k", quoted_price: "$900/day from Sam" }, else: { anything_else: "Thanks" } }
  const withMoney = summary(answers, { seesMoney: true, files: [{ name: "Logo.svg" }], later: false })
  assert.ok(withMoney.some((g) => g.step === "money" && g.rows.some((r) => r.value === "$5,000 – $15,000")))
  assert.ok(withMoney.some((g) => g.step === "assets" && g.rows.some((r) => r.value === "Logo.svg")))
  const viewer = summary(answers, { seesMoney: false, files: [], later: true })
  assert.ok(!viewer.some((g) => g.step === "money"))
  assert.ok(viewer.some((g) => g.step === "assets" && g.rows.some((r) => r.value === "I'll send these later")))
})

test("a stored file: numbered, a safe stem, v5's types only", () => {
  assert.equal(storedName(3, "Our Logo (FINAL) v2.SVG"), "03_our-logo-final-v2.svg")
  assert.equal(storedName(12, "../../etc/passwd.pdf"), "12_passwd.pdf")
  assert.equal(storedName(1, "Brand Guide—2026.pdf"), "01_brand-guide-2026.pdf")
  assert.equal(storedName(1, "テスト.png"), "01_file.png")
  assert.equal(storedName(1, "evil.html"), null)
  assert.equal(storedName(1, "noextension"), null)
  assert.equal(storedName(1, ".pdf"), null)
})
