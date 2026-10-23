// Shared by the suggest-mode property tests (resolve.test.ts, guard.test.ts): a small AV script, a seeded random
// source, and random edits that stay inside one box (the editor never lets one edit span VIDEO and AUDIO).
import type { Node as PMNode } from "@tiptap/pm/model"
import type { Transaction } from "@tiptap/pm/state"
import { scriptSchema } from "./schema"
import { idGenerator, type Author } from "./normalize"

export const schema = scriptSchema()
export const p = (text?: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const cell = (texts: string[]) => (texts.length ? texts : [""]).map((t) => p(t))
export const row = (video: string[], audio: string[]) =>
  schema.nodes.avRow.create({ rowId: null }, [schema.nodes.avVideo.create(null, cell(video)), schema.nodes.avAudio.create(null, cell(audio))])

export function base(): PMNode {
  return schema.nodes.doc.create(null, [
    schema.nodes.heading.create({ level: 2 }, schema.text("Harmon :30")),
    row(["Close up"], ["Hi. Im Mike Harmon and I am running.", "It is a big  job."]),
    row([], ["Second row words here.", "(beat)"]),
    row(["Logo"], ["Paid for by Mike Harmon."]),
  ])
}

export function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

/** Text positions inside textblocks (where a cursor can be), with the textblock's content start and end. */
export function cursors(doc: PMNode) {
  const out: { pos: number; start: number; end: number }[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    for (let i = 0; i <= node.content.size; i++) out.push({ pos: pos + 1 + i, start: pos + 1, end: pos + 1 + node.content.size })
    return false
  })
  return out
}

/** The position of the start of the text `s` in the document (first match). */
export function at(doc: PMNode, s: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.isText && node.text!.includes(s)) found = pos + node.text!.indexOf(s)
    return true
  })
  if (found < 0) throw new Error(`no "${s}"`)
  return found
}

const WORDS = ["vote", "Harmon", "the ", " and", "I’m", "$___ million", "Kentucky", "!", " ", "re-election"]

/** One random edit inside one box: type, delete, replace, Enter, or Backspace at a line start. */
export function randomEdit(r: () => number, doc: PMNode): (tr: Transaction) => void {
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
  const $c = doc.resolve(c.pos)
  const box = $c.node($c.depth - 1)
  const idx = $c.index($c.depth - 1)
  if (kind === 4 && box.type.name !== "doc" && idx + 1 < box.childCount) return (tr) => tr.delete(c.end, c.end + 2)
  return (tr) => tr.insertText(word, c.pos)
}

/** Two people with their own id generators (codes are 8 hex, as personCode() makes them). */
export function twoPeople(): { who: Author; ids: () => string }[] {
  const sam = { code: "5a5a5a5a", clientId: 7 }
  const mike = { code: "3c3c3c3c", clientId: 9 }
  return [
    { who: sam, ids: idGenerator(sam) },
    { who: mike, ids: idGenerator(mike) },
  ]
}
