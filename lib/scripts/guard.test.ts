// The server's suggester guard: every honest suggestion passes (from two people, through Yjs too); direct edits,
// touching someone else's suggestion, forged ids, formatting and Yjs tricks are refused.
// Run: node --conditions=import --import tsx --test lib/scripts/guard.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { EditorState, type Transaction } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"
import * as Y from "yjs"
import { updateYFragment } from "@tiptap/y-tiptap"
import { checkSuggester, checkSuggesterUpdate, type Suggester } from "./guard"
import { suggestEdit, type Author } from "./normalize"
import { resolveSuggestions } from "./resolve"
import { mirrorNodeMarks } from "./marks"
import { YFRAGMENT, pmFromYDoc, viewOf, yDocFromJSON } from "./doc"
import { at, base, randomEdit, rng, row, schema, twoPeople } from "./fuzzkit"

const asSuggester = (a: Author): Suggester => ({ code: a.code, clientIds: new Set([String(a.clientId)]) })

function suggested(doc: PMNode, edit: (tr: Transaction) => void, who: Author, ids: () => string) {
  const state = EditorState.create({ doc, schema })
  const tr = state.tr
  edit(tr)
  const res = suggestEdit(state, tr, who, ids)
  return res.ok ? res.tr.doc : null
}

function direct(doc: PMNode, edit: (tr: Transaction) => void) {
  const tr = EditorState.create({ doc, schema }).tr
  edit(tr)
  return tr.doc
}

/** The Yjs update a browser with `clientId` would send to turn `server`'s document into `next`. */
function updateFor(server: Y.Doc, next: PMNode, clientId: number): Uint8Array {
  const local = new Y.Doc()
  local.clientID = clientId
  Y.applyUpdate(local, Y.encodeStateAsUpdate(server))
  const sv = Y.encodeStateVector(local)
  local.transact(() => updateYFragment(local, local.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next), { mapping: new Map(), isOMark: new Map() }))
  return Y.encodeStateAsUpdate(local, sv)
}

const baseKey = (d: PMNode) => JSON.stringify(viewOf(d, "base").toJSON())

test("honest suggestions from two people always pass (1000 sequences × 16 edits)", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const people = twoPeople()
    const r = rng(seed * 104729)
    let cur = base()
    for (let step = 0; step < 16; step++) {
      const edit = randomEdit(r, cur)
      const p = people[Math.floor(r() * 2)]
      let next: PMNode | null
      try {
        next = suggested(cur, edit, p.who, p.ids)
      } catch {
        continue // not a valid edit on this document
      }
      if (!next) continue // refused in the editor (someone else's suggestion)
      const v = checkSuggester(cur, next, asSuggester(p.who))
      if (!v.ok) assert.fail(`seed ${seed} step ${step}: an honest suggestion was refused: ${v.why}`)
      cur = next
    }
  }
})

test("…and through Yjs, as the server sees them: two browsers, each its own Y.Doc (150 sequences × 12 edits)", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const people = twoPeople()
    const r = rng(seed * 7)
    const server = yDocFromJSON(base().toJSON())
    const tabs = people.map((p) => {
      const d = new Y.Doc()
      d.clientID = Number(p.who.clientId) // set before it holds anything, as a fresh tab's is
      Y.applyUpdate(d, Y.encodeStateAsUpdate(server))
      return d
    })
    for (let step = 0; step < 12; step++) {
      const i = Math.floor(r() * 2)
      const p = people[i]
      const tab = tabs[i]
      Y.applyUpdate(tab, Y.encodeStateAsUpdate(server, Y.encodeStateVector(tab))) // catch up first
      const cur = pmFromYDoc(tab)
      const edit = randomEdit(r, cur)
      let next: PMNode | null
      try {
        next = suggested(cur, edit, p.who, p.ids)
      } catch {
        continue
      }
      if (!next) continue
      const before = Y.encodeStateVector(server)
      tab.transact(() => updateYFragment(tab, tab.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next!), { mapping: new Map(), isOMark: new Map() }))
      const update = Y.encodeStateAsUpdate(tab, before)
      const v = checkSuggesterUpdate(server, update, Number(p.who.clientId), asSuggester(p.who))
      if (!v.ok) assert.fail(`seed ${seed} step ${step}: refused through Yjs: ${v.why}`)
      Y.applyUpdate(server, update)
      assert.equal(baseKey(pmFromYDoc(server)), baseKey(base()), `seed ${seed} step ${step}: the base drifted through Yjs`)
    }
  }
})

test("any edit made DIRECTLY that changes the words is refused (1000 random edits on suggested documents)", () => {
  let refused = 0
  for (let seed = 1; seed <= 1000; seed++) {
    const people = twoPeople()
    const r = rng(seed * 31)
    let cur = base()
    for (let step = 0; step < 6; step++) {
      const p = people[Math.floor(r() * 2)]
      try {
        cur = suggested(cur, randomEdit(r, cur), p.who, p.ids) ?? cur
      } catch {
        // skip
      }
    }
    const mike = people[1]
    let after: PMNode
    try {
      after = direct(cur, randomEdit(r, cur))
    } catch {
      continue
    }
    if (baseKey(after) === baseKey(cur)) continue // e.g. typing inside their own suggestion: not a direct change
    const v = checkSuggester(cur, after, asSuggester(mike.who))
    assert.equal(v.ok, false, `seed ${seed}: a direct change to the words got through`)
    refused++
  }
  assert.ok(refused > 500, `only ${refused} direct edits were tried`)
})

test("tampering is refused, honest edge cases pass", () => {
  const [sam, mike] = twoPeople()
  const M = asSuggester(mike.who)
  // Sam suggests "I’m" for "Im"; Mike suggests " really" after "running".
  let doc = suggested(base(), (tr) => tr.insertText("I’m", at(tr.doc, "Im"), at(tr.doc, "Im") + 2), sam.who, sam.ids)!
  doc = suggested(doc, (tr) => tr.insertText(" really", at(tr.doc, "running") + 7), mike.who, mike.ids)!
  const refuse = (after: PMNode, what: string) => assert.equal(checkSuggester(doc, after, M).ok, false, what)
  const allow = (after: PMNode | null, what: string) => {
    assert.ok(after, `${what}: the editor refused it`)
    const v = checkSuggester(doc, after!, M)
    assert.ok(v.ok, `${what}: ${v.ok ? "" : v.why}`)
  }
  const samsMark = () => {
    let id = ""
    doc.descendants((n) => {
      for (const m of n.marks) if (m.type.name === "insertion" && String(m.attrs.id).startsWith(sam.who.code)) id = String(m.attrs.id)
      return true
    })
    return id
  }

  refuse(direct(doc, (tr) => tr.insertText("Senator ", at(tr.doc, "Mike"))), "plain words typed into the base")
  refuse(direct(doc, (tr) => tr.delete(at(tr.doc, "Paid"), at(tr.doc, "Paid") + 5)), "base words deleted for real")
  refuse(direct(doc, (tr) => tr.delete(at(tr.doc, "I’m"), at(tr.doc, "I’m") + 3)), "Sam's suggested words deleted")
  refuse(direct(doc, (tr) => tr.removeMark(at(tr.doc, "I’m"), at(tr.doc, "I’m") + 3, schema.marks.insertion)), "Sam's suggestion accepted")
  refuse(resolveSuggestions(new Transform(doc), "reject", (id) => id === samsMark()).doc, "Sam's suggestion rejected")
  refuse(
    direct(doc, (tr) => tr.insert(at(tr.doc, "Paid"), schema.text("forged ", [schema.marks.insertion.create({ id: `${sam.who.code}.7.99` })]))),
    "a suggestion forged in Sam's name",
  )
  refuse(
    direct(doc, (tr) => tr.insert(at(tr.doc, "Paid"), schema.text("other tab ", [schema.marks.insertion.create({ id: `${mike.who.code}.12345.1` })]))),
    "a suggestion from a session that isn't bound to Mike",
  )
  refuse(direct(doc, (tr) => tr.setNodeAttribute(tr.doc.content.size - tr.doc.lastChild!.nodeSize, "holdS", 4)), "a row's hold changed")
  refuse(direct(doc, (tr) => tr.addMark(at(tr.doc, "Paid"), at(tr.doc, "Paid") + 4, schema.marks.bold.create())), "a base word made bold")
  refuse(
    direct(doc, (tr) => tr.setNodeAttribute(tr.doc.content.size - tr.doc.lastChild!.nodeSize, "sm", JSON.stringify([{ type: "insertion", attrs: { id: `${sam.who.code}.7.1` } }]))),
    "a base row marked as Sam's suggested row (through its sm attribute)",
  )
  refuse(
    direct(doc, (tr) => tr.setNodeAttribute(tr.doc.content.size - tr.doc.lastChild!.nodeSize, "sm", JSON.stringify([{ type: "insertion", attrs: { id: `${mike.who.code}.9.50` } }]))),
    "a base row marked as Mike's own suggested row (it would vanish from the base)",
  )

  allow(suggested(doc, (tr) => tr.insertText("really ", at(tr.doc, "I’m") + 1), mike.who, mike.ids), "Mike types inside Sam's suggestion")
  allow(suggested(doc, (tr) => tr.delete(at(tr.doc, " really"), at(tr.doc, " really") + 7), mike.who, mike.ids), "Mike takes back his own words")
  allow(suggested(doc, (tr) => tr.split(at(tr.doc, "I’m") + 1), mike.who, mike.ids), "Mike starts a new line inside Sam's suggestion")
  allow(suggested(doc, (tr) => tr.insert(tr.doc.content.size, row(["Wide"], ["New line."])), mike.who, mike.ids), "Mike suggests a new last row")
  allow(suggested(doc, (tr) => tr.delete(at(tr.doc, "Paid"), at(tr.doc, "Paid") + 5), mike.who, mike.ids), "Mike suggests removing words")
})

test("Yjs tricks are refused: another session's changes, and changes that depend on missing ones", () => {
  const [, mike] = twoPeople()
  const M = asSuggester(mike.who)
  const server = yDocFromJSON(base().toJSON())
  const cur = pmFromYDoc(server)
  const next = suggested(cur, (tr) => tr.insertText("really ", at(tr.doc, "running")), mike.who, mike.ids)!
  // made by a different clientID than the one Mike's browser posted
  const foreign = updateFor(server, next, 4242)
  assert.equal(checkSuggesterUpdate(server, foreign, 9, M).ok, false)
  // an update whose predecessor never arrived: two edits by Mike, only the second sent
  const local = new Y.Doc()
  local.clientID = 9
  Y.applyUpdate(local, Y.encodeStateAsUpdate(server))
  const sv0 = Y.encodeStateVector(local)
  local.transact(() => updateYFragment(local, local.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next), { mapping: new Map(), isOMark: new Map() }))
  const sv1 = Y.encodeStateVector(local)
  const next2 = suggested(pmFromYDoc(local), (tr) => tr.insertText("now ", at(tr.doc, "Paid")), mike.who, mike.ids)!
  local.transact(() => updateYFragment(local, local.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next2), { mapping: new Map(), isOMark: new Map() }))
  const second = Y.encodeStateAsUpdate(local, sv1)
  assert.equal(checkSuggesterUpdate(server, second, 9, M).ok, false)
  // and the honest pair, in order, passes
  const first = Y.encodeStateAsUpdate(local, sv0)
  assert.ok(checkSuggesterUpdate(server, first, 9, M).ok)
  assert.equal(checkSuggesterUpdate(server, new Uint8Array([1, 2, 3]), 9, M).ok, false)
})
