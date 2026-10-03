// Suggest mode, made safe for several people (SPEC §14 v4 #5, #6). The library (prosemirror-suggest-changes) turns an
// edit into tracked suggestions; this module wraps it and:
//   1. REFUSES what suggest mode can't represent here: formatting changes, an edit spanning two boxes (VIDEO and AUDIO,
//      or two rows), a row put anywhere but between rows, and removing words someone ELSE suggested (reply to their
//      suggestion instead). The editor shows the reason and keeps the person's words.
//   2. FIXES AUTHORSHIP: the library gives new content the id of whatever suggestion it touches, whoever made it, and
//      rewrites a neighbouring suggestion's id when merging. New content gets the author's OWN id; old content keeps
//      exactly the id it had.
//   3. RECORDS suggested line breaks and joins in the paragraph's `sb` attribute (schema.ts), which resolve.ts reads.
// The server's guard (guard.ts) checks the outcome independently; this module only keeps honest editors inside it.
import type { Mark, Node as PMNode, ResolvedPos } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { ReplaceStep, type Transform } from "@tiptap/pm/transform"
import { transformToSuggestionTransaction } from "@handlewithcare/prosemirror-suggest-changes"
import { isSuggestion, ownerOf } from "./marks"

export type Author = { code: string; clientId: number | string }
export type Suggested = { ok: true; tr: Transaction } | { ok: false; why: string }

const STRUCTURE = new Set(["avRow", "avVideo", "avAudio"])

/** Ids "<code>.<clientID>.<n>", unique per editor session (a new Yjs clientID per page load). */
export function idGenerator(me: Author) {
  let n = 0
  return () => `${me.code}.${me.clientId}.${++n}`
}

/** The start of the nearest isolating ancestor (an AV cell or row), 0 at the top level. */
function box($pos: ResolvedPos) {
  for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.spec.isolating) return $pos.start(d)
  return 0
}

function refusal(tr: Transaction): string | null {
  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i]
    if (!(step instanceof ReplaceStep)) return "Formatting can't be suggested yet. Leave a comment instead."
    const doc = tr.docs[i]
    const { from, to, slice } = step as unknown as { from: number; to: number; slice: import("@tiptap/pm/model").Slice }
    const $from = doc.resolve(from)
    const $to = doc.resolve(to)
    if (box($from) !== box($to)) return "Suggest changes inside one box at a time (VIDEO or AUDIO)."
    let structure = false
    slice.content.descendants((n) => {
      if (STRUCTURE.has(n.type.name)) structure = true
      return !structure
    })
    if (structure && !($from.depth === 0 && $to.depth === 0 && slice.openStart === 0 && slice.openEnd === 0)) {
      return "A new row can only go between rows."
    }
  }
  return null
}

/** Ranges of the final document that this transaction put there (inserted content), in final coordinates. */
function insertedRanges(tr: Transform): [number, number][] {
  let ranges: [number, number][] = []
  for (const step of tr.steps) {
    const map = step.getMap()
    ranges = ranges.map(([a, b]) => [map.map(a, 1), map.map(b, -1)] as [number, number]).filter(([a, b]) => b > a)
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      if (newEnd > newStart) ranges.push([newStart, newEnd])
    })
  }
  return ranges
}

/** The suggestion mark of `type` an edge of a textblock effectively carries: its own inline mark, else a node mark. */
function edgeMark(doc: PMNode, block: { pos: number; node: PMNode }, side: "first" | "last", typeName: string): Mark | null {
  const leaf = side === "first" ? block.node.firstChild : block.node.lastChild
  const inline = leaf?.marks.find((m) => m.type.name === typeName)
  if (inline) return inline
  const $p = doc.resolve(block.pos + 1)
  for (let d = $p.depth; d > 0; d--) {
    const m = $p.node(d).marks.find((x) => x.type.name === typeName)
    if (m) return m
  }
  return null
}

function joinableAcross(doc: PMNode, endA: number, startB: number) {
  const $a = doc.resolve(endA)
  const $b = doc.resolve(startB)
  const d = $a.sharedDepth(startB)
  for (let i = d + 1; i < $a.depth; i++) if ($a.node(i).type.spec.isolating) return false
  for (let i = d + 1; i < $b.depth; i++) if ($b.node(i).type.spec.isolating) return false
  return true
}

/**
 * Record in `sb` the line breaks THIS edit made (ins) or asked to remove (del), between consecutive textblocks.
 * Only boundaries the edit itself touched: the same id can legitimately sit on both sides of a break that was always
 * there (the library gives a replacement's deleted and inserted halves one id; fuzz seed 5951), so "same id on both
 * edges" alone would make Reject join two real paragraphs.
 *   made(posOfB)    — the edit inserted the break before the textblock at posOfB (final coordinates)
 *   removed(posOfB) — the edit's deleted range covered that break
 */
export function recordBoundaries(tr: Transform, made: (posOfB: number, endA: number) => boolean, removed: (posOfB: number) => boolean, fallbackId: () => string) {
  const doc = tr.doc
  const blocks: { pos: number; node: PMNode }[] = []
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      blocks.push({ pos, node })
      return false
    }
    return true
  })
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1]
    const b = blocks[i]
    if (!("sb" in b.node.attrs)) continue
    const endA = a.pos + a.node.nodeSize - 1
    if (!joinableAcross(doc, endA, b.pos + 1)) continue
    const isMade = made(b.pos, endA)
    const isRemoved = removed(b.pos)
    if (!isMade && !isRemoved) continue
    let sb: { ins?: string; del?: string } = {}
    if (!isMade) {
      // a break that was already there keeps what it had (a new break starts clean: a split copies attributes)
      try {
        sb = b.node.attrs.sb ? JSON.parse(b.node.attrs.sb) : {}
      } catch {
        sb = {}
      }
    }
    const idOf = (type: string) => {
      const m = edgeMark(doc, b, "first", type) ?? edgeMark(doc, a, "last", type)
      return m ? String(m.attrs.id) : fallbackId()
    }
    if (isMade) sb.ins = idOf("insertion")
    if (isRemoved && !sb.del) sb.del = idOf("deletion")
    const value = JSON.stringify(sb)
    if (value !== b.node.attrs.sb) tr.setNodeAttribute(b.pos, "sb", value)
  }
  return tr
}

/** Old-document positions of textblocks whose leading break a step of `tr` deleted (Backspace at a line start, or a
 *  deleted range that spans lines). */
function deletedBreaks(tr: Transaction): number[] {
  const out: number[] = []
  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i]
    if (!(step instanceof ReplaceStep)) continue
    const { from, to } = step as unknown as { from: number; to: number }
    if (to <= from) continue
    const doc = tr.docs[i]
    let endPrev = -1
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return true
      if (endPrev >= 0 && from <= endPrev && pos + 1 <= to) {
        out.push(i === 0 ? pos : tr.mapping.slice(0, i).invert().map(pos, 1))
      }
      endPrev = pos + node.nodeSize - 1
      return false
    })
  }
  return out
}

/**
 * Turn a person's edit into suggestions, or refuse it with a reason. `nextId` mints this person's ids.
 * (The library's own id-minting is bypassed: its default auto-increment collides between people.)
 */
export function suggestEdit(state: EditorState, tr: Transaction, me: Author, nextId: () => string): Suggested {
  const why = refusal(tr)
  if (why) return { ok: false, why }
  const ttr = transformToSuggestionTransaction(tr, state, () => nextId())
  const old = state.doc
  const mine = (m: Mark) => ownerOf(m.attrs.id) === me.code

  // 1. Someone else's suggested words may not disappear (the library deletes inserted words for real). Its invisible
  //    anchors (U+200B) don't count: they are in neither view, and `sb` carries what they marked.
  let gone = false
  old.descendants((node, pos) => {
    if (gone) return false
    const ins = node.marks.find((m) => m.type.name === "insertion")
    if (!ins || mine(ins)) return true
    if (!node.isInline) {
      gone = ttr.mapping.mapResult(pos, 1).deletedAfter
      return !gone
    }
    for (let k = 0; k < node.nodeSize && !gone; k++) {
      if (node.isText && node.text![k] === "​") continue
      if (ttr.mapping.mapResult(pos + k, 1).deletedAfter) gone = true
    }
    return false
  })
  if (gone) return { ok: false, why: "That's someone else's suggestion. Reply to it instead of changing it." }

  // 2. Authorship and integrity. Content that existed before this edit keeps EXACTLY the suggestion mark it had: the
  //    library rewrites neighbours' ids when merging, and in two join cases (fuzz seeds 843, 971) marks a letter that
  //    was always there as inserted, or an inserted one as deleted, which would make Reject delete or keep the wrong
  //    letter. The one change old content may get is a NEW deletion mark (the author's). New content gets the
  //    author's own id, even where the library borrowed a neighbour's.
  const fresh = new Map<string, string>() // other person's id → my id, one per suggestion this edit touched
  const own = (m: Mark) => {
    if (mine(m)) return m
    const key = String(m.attrs.id)
    if (!fresh.has(key)) fresh.set(key, nextId())
    return m.type.create({ ...m.attrs, id: fresh.get(key) })
  }
  const keepInline = new Map<number, Mark>() // new-doc position of a surviving old char → its old mark
  const keepBlock = new Map<number, Mark>()
  old.descendants((node, pos) => {
    const s = node.marks.find(isSuggestion)
    if (!node.isInline) {
      if (s) {
        const r = ttr.mapping.mapResult(pos, 1)
        if (!r.deletedAfter) keepBlock.set(r.pos, s)
      }
      return true
    }
    if (s) {
      const step = node.isText ? 1 : node.nodeSize
      for (let k = 0; k < node.nodeSize; k += step) {
        const r = ttr.mapping.mapResult(pos + k, 1)
        if (!r.deletedAfter) keepInline.set(r.pos, s)
      }
    }
    return false
  })
  const added = insertedRanges(ttr)
  const isNew = (from: number, to: number) => added.some(([a, b]) => from >= a && to <= b)
  const wanted = (k: number, size: number, cur: Mark | null, keep: Map<number, Mark>): Mark | null => {
    const kept = keep.get(k)
    if (kept) return kept
    if (!cur) return null
    if (isNew(k, k + size)) return own(cur)
    return cur.type.name === "deletion" ? own(cur) : null // old plain content can be newly deleted, never inserted
  }
  const same = (a: Mark | null, b: Mark | null) => (a === null ? b === null : b !== null && a.eq(b))
  const doc = ttr.doc
  doc.descendants((node, pos) => {
    const cur = node.marks.find(isSuggestion) ?? null
    if (!node.isInline) {
      const want = wanted(pos, 1, cur, keepBlock)
      if (!same(want, cur)) {
        if (cur) ttr.removeNodeMark(pos, cur)
        if (want) ttr.addNodeMark(pos, want)
      }
      return true
    }
    const end = pos + node.nodeSize
    const step = node.isText ? 1 : node.nodeSize
    let runFrom = pos
    let runWant = wanted(pos, step, cur, keepInline)
    for (let k = pos + step; k <= end; k += step) {
      const want = k < end ? wanted(k, step, cur, keepInline) : undefined
      if (want !== undefined && same(want, runWant)) continue
      if (!same(runWant, cur)) {
        if (cur) ttr.removeMark(runFrom, k, cur)
        if (runWant) ttr.addMark(runFrom, k, runWant)
      }
      if (want !== undefined) {
        runFrom = k
        runWant = want
      }
    }
    return false
  })

  // 3. Breaks and joins this edit made, now that every edge carries its author's id.
  const removedAt = new Set(deletedBreaks(tr).map((p) => ttr.mapping.map(p, 1)))
  recordBoundaries(
    ttr,
    (posOfB, endA) => isNew(posOfB, posOfB + 1) || isNew(endA, endA + 1),
    (posOfB) => removedAt.has(posOfB),
    nextId,
  )
  return { ok: true, tr: ttr }
}
