// Restore (SPEC §14 v4 #13): the live document comes back to exactly what the old version said, suggestions and
// whole suggested rows included, and rows nobody touched keep their Yjs items.
// Run: node --conditions=import --import tsx --test lib/scripts/restore.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import * as Y from "yjs"
import { EditorState } from "@tiptap/pm/state"
import { updateYFragment } from "@tiptap/y-tiptap"
import { YFRAGMENT, pmFromYDoc, prompterText, rowsOf, viewOf, yDocFromJSON } from "./doc"
import { mirrorNodeMarks } from "./marks"
import { restoreUpdate } from "./restore"
import { suggestEdit, idGenerator } from "./normalize"
import { at, base, row, schema } from "./fuzzkit"

function edit(doc: Y.Doc, change: (tr: import("@tiptap/pm/state").Transaction) => void, suggest = false) {
  const cur = pmFromYDoc(doc)
  const state = EditorState.create({ doc: cur, schema })
  const tr = state.tr
  change(tr)
  const me = { code: "5a5a5a5a", clientId: doc.clientID }
  const next = suggest ? (suggestEdit(state, tr, me, idGenerator(me)) as { ok: true; tr: typeof tr }).tr.doc : tr.doc
  doc.transact(() => updateYFragment(doc, doc.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next), { mapping: new Map(), isOMark: new Map() }))
}

test("restoring an old version brings back exactly its words, suggestions and rows", () => {
  const live = yDocFromJSON(base().toJSON())
  edit(live, (tr) => tr.insertText("I’m", at(tr.doc, "Im"), at(tr.doc, "Im") + 2), true) // a suggestion
  const v2 = Y.encodeStateAsUpdate(live)
  const v2doc = pmFromYDoc(live)
  // later: words deleted outright, a row added, another suggestion
  edit(live, (tr) => tr.delete(at(tr.doc, "Second row"), at(tr.doc, "Second row") + 11))
  edit(live, (tr) => tr.insert(tr.doc.content.size, row(["Wide"], ["Vote November 3."])))
  edit(live, (tr) => tr.insertText("really ", at(tr.doc, "running")), true)
  assert.notEqual(prompterText(rowsOf(viewOf(pmFromYDoc(live), "accepted"))), prompterText(rowsOf(viewOf(v2doc, "accepted"))))

  const { update } = restoreUpdate(live, v2)
  Y.applyUpdate(live, update)
  assert.ok(pmFromYDoc(live).eq(v2doc), "the restored document isn't version 2")
})

test("a restore is a minimal change: a row nobody touched keeps its Yjs items", () => {
  const live = yDocFromJSON(base().toJSON())
  const v1 = Y.encodeStateAsUpdate(live)
  const lastRow = () => live.getXmlFragment(YFRAGMENT).get(live.getXmlFragment(YFRAGMENT).length - 1) as Y.XmlElement
  const before = lastRow()
  edit(live, (tr) => tr.insertText("Senator ", at(tr.doc, "Mike Harmon and")))
  const { update } = restoreUpdate(live, v1)
  Y.applyUpdate(live, update)
  assert.ok(pmFromYDoc(live).eq(pmFromYDoc((() => { const d = new Y.Doc(); Y.applyUpdate(d, v1); return d })())))
  assert.equal(lastRow(), before, "the untouched last row was replaced instead of kept")
})

test("a restore made while someone else's change is in flight merges, never loses their words", () => {
  const server = yDocFromJSON(base().toJSON())
  const v1 = Y.encodeStateAsUpdate(server)
  edit(server, (tr) => tr.insertText("Senator ", at(tr.doc, "Mike Harmon and")))
  // a browser types in the last row while the restore is computed from the server's state
  const browser = new Y.Doc()
  Y.applyUpdate(browser, Y.encodeStateAsUpdate(server))
  const sv = Y.encodeStateVector(browser)
  edit(browser, (tr) => tr.insertText("proudly ", at(tr.doc, "Paid for")))
  const typed = Y.encodeStateAsUpdate(browser, sv)
  const { update } = restoreUpdate(server, v1)
  Y.applyUpdate(server, update)
  Y.applyUpdate(server, typed)
  const text = prompterText(rowsOf(viewOf(pmFromYDoc(server), "accepted")))
  assert.ok(text.includes("proudly Paid for"), "the browser's words were lost")
  assert.ok(!text.includes("Senator"), "the restore didn't take")
})
