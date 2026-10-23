// The script document layer, against the REAL scripts (read from Dropbox at test time, never copied into the repo) and
// synthetic cases for the shapes those don't have.
// Run: node --import tsx --test lib/scripts/doc.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import * as Y from "yjs"
import type { JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap"
import {
  YFRAGMENT,
  importToPM,
  pendingSuggestions,
  plainText,
  pmFromJSON,
  pmFromYDoc,
  prompterText,
  renderScript,
  rowsOf,
  viewOf,
  yDocFromJSON,
  type ScriptImport,
} from "./doc"
import { scriptSchema } from "./schema"
import { mirrorNodeMarks } from "./marks"

const TORRES = join(homedir(), "Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE/Clients/Torres")
const HARMON = join(TORRES, "torres_mike-harmon-sos_26-037/scripts")
const GEX = join(TORRES, "torres_gex-williams_26-033/scripts")
const IMPORTER = join(__dirname, "../../scripts/import_script.py")

/** The importer's own paragraph normalisation (trailing spaces/tabs dropped, blank lines separate paragraphs). */
function norm(text: string): string {
  const paras: string[] = []
  let cur: string[] = []
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/[ \t]+$/, "")
    if (line.trim() === "") {
      if (cur.length) paras.push(cur.join("\n"))
      cur = []
    } else cur.push(line)
  }
  if (cur.length) paras.push(cur.join("\n"))
  return paras.join("\n\n") + "\n"
}

function runImporter(args: string[]): ScriptImport {
  return JSON.parse(execFileSync("python3", [IMPORTER, ...args], { encoding: "utf8" }))
}

/** The client's own words as a prompter would read them, straight from the import (no editor in between). */
function importedPrompter(imp: ScriptImport) {
  return prompterText(
    imp.rows.map((r) => ({ row_id: null, video: r.video, speaker: r.audio[0]?.speaker ?? null, audio: r.audio.map((a) => a.text), directions: r.directions, hold_s: null })),
  )
}

const fixtures = [
  {
    name: "harmon",
    canon: join(HARMON, "Harmon script as texted 2026-10-02 0655 (CURRENT).txt"),
    prompter: join(HARMON, "PROMPTER_Harmon_v3_FULL-READ_2026-10-02.txt"),
    args: (c: string, p: string) => ["harmon-texted", c, "--title", "Harmon SoS", "--prompter", p],
  },
  ...["Family", "Waste", "Appropriation"].map((spot) => ({
    name: `gex-${spot.toLowerCase()}`,
    canon: join(GEX, "source/2026-08-28_williams-scripts_canonical-snapshot.md"),
    prompter: join(GEX, `teleprompter/${spot}_PROMPTER.txt`),
    args: (c: string, p: string) => ["gex-snapshot", c, "--spot", spot, "--title", spot, "--prompter", p],
  })),
]

const vectors = JSON.parse(readFileSync(join(__dirname, "timing.vectors.json"), "utf8")) as { rows: { name?: string; words?: number; total_s: number }[] }

for (const f of fixtures) {
  test(`${f.name}: accepting every suggestion reproduces the PROMPTER file; rejecting them leaves the client's words`, { skip: !existsSync(f.canon) && "Torres Dropbox folder not on this machine" }, () => {
    const imp = runImporter(f.args(f.canon, f.prompter))
    const json = importToPM(imp, { authorCode: "sam" })
    const doc = pmFromJSON(json)
    doc.check()
    assert.equal(prompterText(rowsOf(viewOf(doc, "accepted"))), norm(readFileSync(f.prompter, "utf8")))
    assert.equal(prompterText(rowsOf(viewOf(doc, "base"))), importedPrompter(imp))
    assert.equal(pendingSuggestions(doc), imp.suggestions.length)

    // The render is the BASE text (v4 #7) and times exactly like the reference did on the client's words.
    const r = renderScript(doc)
    const v = vectors.rows.find((c) => c.name === f.name)
    assert.ok(v, `no timing vector named ${f.name}`)
    assert.equal(r.words, v.words)
    assert.ok(Math.abs(r.total_s - v.total_s) < 1e-3, `${r.total_s} vs ${v.total_s}`)
    assert.equal(r.pending_suggestions, imp.suggestions.length)

    // Through Yjs and back: nothing lost.
    assert.ok(pmFromYDoc(yDocFromJSON(json)).eq(doc), "the Yjs round trip changed the document")
  })
}

test("harmon: the base render reads 0:57 with no target and keeps the direction out of the words", { skip: !existsSync(fixtures[0].canon) && "Torres Dropbox folder not on this machine" }, () => {
  const imp = runImporter(fixtures[0].args(fixtures[0].canon, fixtures[0].prompter))
  const r = renderScript(pmFromJSON(importToPM(imp, { authorCode: "sam" })))
  assert.equal(r.label, "0:57 · no target set")
  assert.deepEqual(r.rows[2].directions, ["heightened speed on delivery but slow down for next line"])
  assert.deepEqual(r.rows[6].audio, [])
  assert.deepEqual(r.rows[6].video, ["Logo fade in. Paid for by Mike Harmon."])
  assert.ok(r.rows[0].audio[0].startsWith("Hi. Im Mike Harmon"), "the render shows Mike's words until he accepts the fix")
})

// ------------------------------------------------------------------------------------------------- synthetic

const synthetic = (rows: ScriptImport["rows"], suggestions: ScriptImport["suggestions"]): ScriptImport => ({
  format: "osc-script-import/1",
  adapter: "test",
  title: "t",
  source: { path: "", sha256: "", label: "" },
  rows,
  suggestions,
})

test("offsets are code points (an emoji before the fix doesn't shift it)", () => {
  const imp = synthetic([{ video: [], audio: [{ speaker: null, text: "🎬 Im here" }], directions: [] }], [
    { row: 0, field: "audio", start: 2, end: 4, replace: "I’m" },
  ])
  const doc = pmFromJSON(importToPM(imp, { authorCode: "sam" }))
  assert.equal(prompterText(rowsOf(viewOf(doc, "accepted"))), "🎬 I’m here\n")
  assert.equal(prompterText(rowsOf(viewOf(doc, "base"))), "🎬 Im here\n")
})

test("a line break inside a paragraph survives, suggested or not", () => {
  const imp = synthetic([{ video: [], audio: [{ speaker: null, text: "line one\nline two" }], directions: [] }], [
    { row: 0, field: "audio", start: 4, end: 9, replace: " 1, " },
  ])
  const doc = pmFromJSON(importToPM(imp, { authorCode: "sam" }))
  doc.check()
  assert.equal(prompterText(rowsOf(viewOf(doc, "base"))), "line one\nline two\n")
  assert.equal(prompterText(rowsOf(viewOf(doc, "accepted"))), "line 1, line two\n")
  // the suggested line break's marks ride in its `sm` through Yjs (y-tiptap drops marks on inline nodes too)
  assert.ok(pmFromYDoc(yDocFromJSON(importToPM(imp, { authorCode: "sam" }))).eq(mirrorNodeMarks(doc)))
})

test("a speaker label only the PROMPTER has comes in as one suggestion", () => {
  const imp = synthetic([{ video: ["Wide"], audio: [{ speaker: null, text: "Vote." }], directions: [] }], [
    { row: 0, field: "speaker", start: 0, end: 0, replace: "NARRATOR (VO)" },
  ])
  const doc = pmFromJSON(importToPM(imp, { authorCode: "sam" }))
  assert.equal(pendingSuggestions(doc), 1)
  assert.equal(prompterText(rowsOf(viewOf(doc, "base"))), "Vote.\n")
  assert.equal(prompterText(rowsOf(viewOf(doc, "accepted"))), "NARRATOR (VO):\nVote.\n")
})

test("an end card is VIDEO only, holds time when told to, and never reaches the prompter", () => {
  const json = importToPM(synthetic([
    { video: [], audio: [{ speaker: "Judy", text: "one two three four five" }], directions: [] },
    { video: ["Logo"], audio: [], directions: [] },
  ], []), { authorCode: "sam" })
  const end = json.content![1]
  end.attrs = { ...end.attrs, holdS: 3 }
  const r = renderScript(pmFromJSON(json))
  assert.equal(r.prompter_text, "one two three four five\n")
  assert.equal(r.total_s, 5)
  assert.equal(r.rows[1].seconds, 3)
  assert.equal(r.rows[0].speaker, "Judy")
})

/** A two-row doc where row 2 is a whole suggested row (a NODE mark) and row 1 is suggested for removal. */
function rowSuggestions(): JSONContent {
  const row = (words: string, marks?: { type: string; attrs: Record<string, unknown> }[]): JSONContent => ({
    type: "avRow",
    ...(marks ? { marks } : {}),
    content: [
      { type: "avVideo", content: [{ type: "paragraph" }] },
      { type: "avAudio", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] },
    ],
  })
  return {
    type: "doc",
    content: [
      row("Stays."),
      row("Goes.", [{ type: "deletion", attrs: { id: "abc12345.77.1" } }]),
      row("Arrives.", [{ type: "insertion", attrs: { id: "abc12345.77.2" } }]),
    ],
  }
}

test("whole suggested rows: base keeps the removed row and drops the new one; accepted the reverse", () => {
  const doc = pmFromJSON(rowSuggestions())
  assert.equal(prompterText(rowsOf(viewOf(doc, "base"))), "Stays.\n\nGoes.\n")
  assert.equal(prompterText(rowsOf(viewOf(doc, "accepted"))), "Stays.\n\nArrives.\n")
  assert.equal(pendingSuggestions(doc), 2)
})

test("y-tiptap drops node marks; the sm mirror carries them through Yjs", () => {
  const doc = pmFromJSON(rowSuggestions())
  // The gap, pinned: without the mirror a suggested row arrives as a plain row (a direct edit).
  const raw = prosemirrorJSONToYDoc(scriptSchema(), doc.toJSON(), YFRAGMENT)
  const lost = yXmlFragmentToProseMirrorRootNode(raw.getXmlFragment(YFRAGMENT), scriptSchema())
  assert.equal(lost.child(2).marks.length, 0)
  // With it: the marks come back, and so do both views.
  const back = pmFromYDoc(yDocFromJSON(rowSuggestions()))
  assert.equal(back.child(1).marks[0]?.type.name, "deletion")
  assert.equal(back.child(2).marks[0]?.type.name, "insertion")
  assert.equal(prompterText(rowsOf(viewOf(back, "accepted"))), "Stays.\n\nArrives.\n")
  // And an update made on one Y.Doc carries the attribute to another.
  const a = yDocFromJSON(rowSuggestions())
  const b = new Y.Doc()
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  assert.equal(pmFromYDoc(b).child(2).marks[0]?.attrs.id, "abc12345.77.2")
})

test("plain text (what an approval hashes) reads VIDEO and AUDIO per row", () => {
  const json = importToPM(synthetic([{ video: ["Close up"], audio: [{ speaker: "Judy", text: "Hello." }], directions: ["warm"] }], []), { authorCode: "sam" })
  assert.equal(plainText(viewOf(pmFromJSON(json), "base")), "VIDEO: Close up\nAUDIO: Judy: Hello.\n(warm)\n")
})
