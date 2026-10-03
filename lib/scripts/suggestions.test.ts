// The editor's suggestion list reads like a person would say it.
// Run: node --conditions=import --import tsx --test lib/scripts/suggestions.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { EditorState, type Transaction } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import { describe, listSuggestions } from "./suggestions"
import { idGenerator, suggestEdit } from "./normalize"
import { at, base, row, schema } from "./fuzzkit"

const sam = { code: "5a5a5a5a", clientId: 7 }
const ids = idGenerator(sam)
function suggest(doc: PMNode, edit: (tr: Transaction) => void) {
  const state = EditorState.create({ doc, schema })
  const tr = state.tr
  edit(tr)
  const res = suggestEdit(state, tr, sam, ids)
  assert.ok(res.ok)
  return res.tr.doc
}

test("a replacement, an addition, a removal, a new row and a new line, each one line", () => {
  let doc = suggest(base(), (tr) => tr.insertText("I’m", at(tr.doc, "Im"), at(tr.doc, "Im") + 2))
  doc = suggest(doc, (tr) => tr.insertText("really ", at(tr.doc, "running")))
  doc = suggest(doc, (tr) => tr.delete(at(tr.doc, "big"), at(tr.doc, "big") + 4))
  doc = suggest(doc, (tr) => tr.insert(tr.doc.content.size, row(["Wide"], ["Vote."])))
  doc = suggest(doc, (tr) => tr.split(at(tr.doc, "Paid for") + 9))
  const lines = listSuggestions(doc).map(describe)
  assert.deepEqual(lines, ["Im → I’m", "adds “really”", "removes “big”", "a new line", "a new row"])
  assert.ok(listSuggestions(doc).every((s) => s.owner === sam.code))
})
