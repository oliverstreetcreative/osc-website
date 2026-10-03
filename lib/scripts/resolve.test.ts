// Tracking (the library) + resolving (resolve.ts), as a property: for any edit E a person makes in suggest mode on a
// document D, REJECT ALL gives back D exactly and ACCEPT ALL gives exactly E(D), the edit made directly. Fixed cases
// for every shape (split, join, whole row, last row, paste), then random edits and random sequences.
// Run: node --conditions=import --import tsx --test lib/scripts/resolve.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { EditorState, type Transaction } from "@tiptap/pm/state"
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"
import { scriptSchema } from "./schema"
import { idGenerator, suggestEdit } from "./normalize"
import { resolveSuggestions, suggestionIds } from "./resolve"
import { pmFromYDoc, yDocFromJSON } from "./doc"
import { mirrorNodeMarks } from "./marks"

const schema = scriptSchema()
const p = (text?: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const cell = (texts: string[]) => (texts.length ? texts : [""]).map((t) => p(t))
const row = (video: string[], audio: string[]) =>
  schema.nodes.avRow.create({ rowId: null }, [schema.nodes.avVideo.create(null, cell(video)), schema.nodes.avAudio.create(null, cell(audio))])

function base(): PMNode {
  return schema.nodes.doc.create(null, [
    schema.nodes.heading.create({ level: 2 }, schema.text("Harmon :30")),
    row(["Close up"], ["Hi. Im Mike Harmon and I am running.", "It is a big  job."]),
    row([], ["Second row words here.", "(beat)"]),
    row(["Logo"], ["Paid for by Mike Harmon."]),
  ])
}

const me = { code: "abc12345", clientId: 42 }
const gen = idGenerator(me)

/** Make `edit` as a person in suggest mode: the tracked document, and the document the same edit makes directly. */
function suggest(doc: PMNode, edit: (tr: Transaction) => void, who = me, ids = gen) {
  const state = EditorState.create({ doc, schema })
  const tr = state.tr
  edit(tr)
  const res = suggestEdit(state, tr, who, ids)
  if (!res.ok) throw new Error(`refused: ${res.why}`)
  return { direct: tr.doc, tracked: res.tr.doc }
}

/** Where top-level block i starts. */
function blockStart(doc: PMNode, i: number) {
  let pos = 0
  for (let k = 0; k < i; k++) pos += doc.child(k).nodeSize
  return pos
}

const reject = (d: PMNode) => resolveSuggestions(new Transform(d), "reject").doc
const accept = (d: PMNode) => resolveSuggestions(new Transform(d), "accept").doc

function same(a: PMNode, b: PMNode, what: string) {
  if (!a.eq(b)) assert.fail(`${what}\n got: ${JSON.stringify(a.toJSON())}\nwant: ${JSON.stringify(b.toJSON())}`)
}

/** Text positions inside textblocks (where a cursor can be), with the textblock's start and end. */
function cursors(doc: PMNode) {
  const out: { pos: number; start: number; end: number }[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    for (let i = 0; i <= node.content.size; i++) out.push({ pos: pos + 1 + i, start: pos + 1, end: pos + 1 + node.content.size })
    return false
  })
  return out
}

/** The position of the start of the text `s` in the document (first match). */
function at(doc: PMNode, s: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.isText && node.text!.includes(s)) found = pos + node.text!.indexOf(s)
    return true
  })
  if (found < 0) throw new Error(`no "${s}"`)
  return found
}

function check(name: string, edit: (tr: Transaction) => void, doc = base()) {
  const { direct, tracked } = suggest(doc, edit)
  tracked.check()
  same(reject(tracked), doc, `${name}: reject all`)
  same(accept(tracked), direct, `${name}: accept all`)
  // Through Yjs (node marks ride in sm) and back: still exact (sm re-mirrored, as the editor's plugin does).
  const back = pmFromYDoc(yDocFromJSON(tracked.toJSON()))
  same(mirrorNodeMarks(reject(back)), doc, `${name}: reject after Yjs`)
  same(mirrorNodeMarks(accept(back)), direct, `${name}: accept after Yjs`)
  return { direct, tracked }
}

test("typing, deleting and replacing words", () => {
  check("insert", (tr) => tr.insertText("really ", at(tr.doc, "running")))
  check("delete", (tr) => tr.delete(at(tr.doc, "big"), at(tr.doc, "big") + 3))
  check("replace", (tr) => tr.insertText("I’m", at(tr.doc, "Im"), at(tr.doc, "Im") + 2))
  check("delete in the heading", (tr) => tr.delete(at(tr.doc, ":30"), at(tr.doc, ":30") + 3))
})

test("Enter: a split mid-text, at the end, at the start; and typing into the new paragraph", () => {
  check("split mid", (tr) => tr.split(at(tr.doc, "and I am")))
  check("split at end", (tr) => tr.split(at(tr.doc, "running.") + "running.".length))
  check("split at start", (tr) => tr.split(at(tr.doc, "Hi.")))
  const once = suggest(base(), (tr) => tr.split(at(tr.doc, "running.") + "running.".length))
  const twice = suggest(once.tracked, (tr) => tr.insertText("New line.", tr.selection.from))
  same(reject(twice.tracked), base(), "split then type: reject")
})

test("Backspace across a paragraph boundary in one cell (a suggested join)", () => {
  check("join", (tr) => {
    const b = at(tr.doc, "It is a big")
    tr.delete(b - 2, b)
  })
})

test("a whole new row, anywhere, including LAST (the library's own reject throws there)", () => {
  const newRow = () => row(["Wide"], ["Brand new words."])
  check("row in the middle", (tr) => tr.insert(blockStart(tr.doc, 2), newRow()))
  check("row at the end", (tr) => tr.insert(tr.doc.content.size, newRow()))
})

test("removing a whole row, including the last one", () => {
  const rowAt = (doc: PMNode, i: number) => [blockStart(doc, i), blockStart(doc, i) + doc.child(i).nodeSize] as const
  check("middle row", (tr) => tr.delete(...rowAt(tr.doc, 2)))
  check("last row", (tr) => tr.delete(...rowAt(tr.doc, 3)))
})

test("refused: formatting, an edit across two boxes, a row inside a box", () => {
  const refused = (edit: (tr: Transaction) => void) => {
    const state = EditorState.create({ doc: base(), schema })
    const tr = state.tr
    edit(tr)
    return suggestEdit(state, tr, me, gen)
  }
  assert.equal(refused((tr) => tr.addMark(at(tr.doc, "Mike"), at(tr.doc, "Mike") + 4, schema.marks.bold.create())).ok, false)
  assert.equal(refused((tr) => tr.delete(at(tr.doc, "Close"), at(tr.doc, "Hi."))).ok, false)
  assert.equal(refused((tr) => tr.insert(at(tr.doc, "Second row"), row(["x"], ["y"]))).ok, false)
})

test("two people: new words get their OWN id, even typed right against someone else's suggestion", () => {
  const sam = { code: "5a5a5a5a", clientId: 7 }
  const mike = { code: "3c3c3c3c", clientId: 9 }
  const samIds = idGenerator(sam)
  const mikeIds = idGenerator(mike)
  const one = suggest(base(), (tr) => tr.insertText("I’m", at(tr.doc, "Im"), at(tr.doc, "Im") + 2), sam, samIds)
  // Mike types right after Sam's suggested "I’m" and deletes the word right before it
  const two = suggest(one.tracked, (tr) => tr.insertText(" really", at(tr.doc, "I’m") + 3), mike, mikeIds)
  const three = suggest(two.tracked, (tr) => tr.delete(at(tr.doc, "Hi.") , at(tr.doc, "Hi.") + 3), mike, mikeIds)
  const owners = new Map<string, string>()
  three.tracked.descendants((node) => {
    for (const m of node.marks) if (["insertion", "deletion"].includes(m.type.name) && node.isText) owners.set(node.text!, String(m.attrs.id).split(".")[0])
    return true
  })
  assert.equal(owners.get("I’m"), sam.code)
  assert.equal(owners.get("Im"), sam.code)
  assert.equal(owners.get(" really"), mike.code)
  assert.equal(owners.get("Hi."), mike.code)
  // Mike can't remove Sam's suggested words
  const state = EditorState.create({ doc: three.tracked, schema })
  const tr = state.tr.delete(at(three.tracked, "I’m"), at(three.tracked, "I’m") + 3)
  assert.equal(suggestEdit(state, tr, mike, mikeIds).ok, false)
  same(reject(three.tracked), base(), "two people: reject all")
})

test("pasting three paragraphs into the middle of a line", () => {
  const slice = new Slice(Fragment.from([p("one"), p("two"), p("three")]), 1, 1)
  check("paste", (tr) => tr.replace(at(tr.doc, "words here"), at(tr.doc, "words here"), slice))
})

test("a delete across two paragraphs of one cell", () => {
  check("span", (tr) => tr.delete(at(tr.doc, "running."), at(tr.doc, "big")))
})

test("accept or reject ONE suggestion leaves the others pending", () => {
  const one = suggest(base(), (tr) => tr.insertText("really ", at(tr.doc, "running")))
  const two = suggest(one.tracked, (tr) => tr.delete(at(tr.doc, "Second"), at(tr.doc, "Second") + 7))
  const ids = suggestionIds(two.tracked)
  assert.equal(ids.length, 2)
  const first = resolveSuggestions(new Transform(two.tracked), "accept", (id) => id === ids[0]).doc
  assert.deepEqual(suggestionIds(first), [ids[1]])
  same(reject(first), suggest(base(), (tr) => tr.insertText("really ", at(tr.doc, "running"))).direct, "accept one, reject the rest")
})

// ------------------------------------------------------------------------------------------------- random

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

const WORDS = ["vote", "Harmon", "the ", " and", "I’m", "$___ million", "Kentucky", "!", " ", "re-election"]

/** One random edit that stays inside one cell (the editor never lets a single edit span VIDEO and AUDIO). */
function randomEdit(r: () => number, doc: PMNode): (tr: Transaction) => void {
  const cs = cursors(doc)
  const c = cs[Math.floor(r() * cs.length)]
  const kind = Math.floor(r() * 6)
  const word = WORDS[Math.floor(r() * WORDS.length)]
  if (kind === 0) return (tr) => tr.insertText(word, c.pos)
  if (kind === 1) {
    const to = Math.min(c.end, c.pos + 1 + Math.floor(r() * 6))
    return (tr) => (to > c.pos ? tr.delete(c.pos, to) : tr.insertText(word, c.pos))
  }
  if (kind === 2) {
    const to = Math.min(c.end, c.pos + 1 + Math.floor(r() * 4))
    return (tr) => tr.insertText(word, c.pos, to)
  }
  if (kind === 3) return (tr) => tr.split(c.pos)
  // a join with the next paragraph in the same cell, when there is one
  const $c = doc.resolve(c.pos)
  const cell = $c.node($c.depth - 1)
  const idx = $c.index($c.depth - 1)
  if (kind === 4 && cell.type.name !== "doc" && idx + 1 < cell.childCount) return (tr) => tr.delete(c.end, c.end + 2)
  return (tr) => tr.insertText(word, c.pos)
}

test("random single edits: reject all = before, accept all = the direct edit (500 seeds)", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const r = rng(seed)
    const doc = base()
    const edit = randomEdit(r, doc)
    let res
    try {
      res = suggest(doc, edit)
    } catch (e) {
      assert.fail(`seed ${seed}: the tracker threw: ${(e as Error).message}`)
    }
    if (res.direct.eq(doc)) continue
    same(reject(res.tracked), doc, `seed ${seed}: reject all`)
    same(accept(res.tracked), res.direct, `seed ${seed}: accept all`)
  }
})

test("random sequences of 16 suggested edits by two people: reject all always gives back the original (1000 seeds)", () => {
  const people = [
    { who: { code: "5a5a5a5a", clientId: 7 }, ids: idGenerator({ code: "5a5a5a5a", clientId: 7 }) },
    { who: { code: "3c3c3c3c", clientId: 9 }, ids: idGenerator({ code: "3c3c3c3c", clientId: 9 }) },
  ]
  let refusedOthers = 0
  // FUZZ_SEEDS / FUZZ_STEPS widen it for a long run (10/3: 10,000 × 24 clean, after the seed 843 / 971 / 5951 fixes
  // in normalize.ts); the default stays quick.
  for (let seed = 1; seed <= Number(process.env.FUZZ_SEEDS ?? 1000); seed++) {
    const r = rng(seed * 7919)
    const doc = base()
    let cur = doc
    for (let step = 0; step < Number(process.env.FUZZ_STEPS ?? 16); step++) {
      const edit = randomEdit(r, cur)
      const p = people[Math.floor(r() * 2)]
      const state = EditorState.create({ doc: cur, schema })
      const tr = state.tr
      try {
        edit(tr)
      } catch {
        continue // an edit that isn't valid on this document (ProseMirror refused it); the editor would too
      }
      let res
      try {
        res = suggestEdit(state, tr, p.who, p.ids)
      } catch (e) {
        assert.fail(`seed ${seed} step ${step}: the tracker threw: ${(e as Error).message}`)
      }
      if (!res.ok) {
        refusedOthers++ // touching the other person's suggestion: refused, nothing changes
        continue
      }
      cur = res.tr.doc
      cur.check()
      same(reject(cur), doc, `seed ${seed} step ${step}: reject all`)
      accept(cur).check()
    }
    same(mirrorNodeMarks(reject(pmFromYDoc(yDocFromJSON(cur.toJSON())))), doc, `seed ${seed}: reject all after Yjs`)
  }
  assert.ok(refusedOthers > 0, "the fuzz never tried to change someone else's suggestion")
})
