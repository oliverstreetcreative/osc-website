// Accept and reject suggestions: OUR implementation, used by the render's two views AND the editor's Accept / Reject /
// Accept all / Reject all, so what the render says is exactly what the buttons do.
//
// Not the library's applySuggestions/revertSuggestions (@handlewithcare/prosemirror-suggest-changes 0.1.8), which we
// keep only for TRACKING edits. Found in its source and pinned by tests (10/3): it throws rejecting a suggested LAST
// block (textBetween past the end of the document), it leaves the zero-width anchors inside accepted words, it eats a
// space when rejecting (so "a  b" can't come back exactly, and the server's guard would refuse a fair suggestion), and
// its cross-block delete joins through isolating cells (VIDEO text would slide into AUDIO). Same marks and the same
// conventions the tracker writes: insertion / deletion / modification marks on text and on whole nodes, and a
// zero-width space (U+200B) carrying the mark at each side of a suggested paragraph split or join.
import type { Mark, MarkType, Node as PMNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"

export type Resolution = "accept" | "reject"
const ZW = "​"

/** Can the boundary between two textblocks be closed without crossing an isolating node (an AV cell, a row)? */
function joinable(doc: PMNode, endA: number, startB: number) {
  const $a = doc.resolve(endA)
  const $b = doc.resolve(startB)
  const d = $a.sharedDepth(startB)
  for (let i = d + 1; i < $a.depth; i++) if ($a.node(i).type.spec.isolating) return false
  for (let i = d + 1; i < $b.depth; i++) if ($b.node(i).type.spec.isolating) return false
  return true
}

/**
 * Accept or reject the suggestions `pick` selects (by id; default all) by adding steps to `tr`.
 * Accept: inserted content stays (mark off), deleted content goes, a suggested join closes. Reject: inserted content
 * goes and a suggested split closes, deleted content stays (mark off). Anchors (U+200B) in resolved content go.
 * Modifications (node attribute / type changes): accept keeps the new value; reject puts the old one back.
 */
export function resolveSuggestions(tr: Transform, how: Resolution, pick: (id: string) => boolean = () => true): Transform {
  const doc = tr.doc
  const start = tr.steps.length
  const { insertion, deletion, modification } = doc.type.schema.marks
  const goes = how === "accept" ? deletion : insertion
  const stays = how === "accept" ? insertion : deletion
  const picked = (m: Mark | undefined | null): m is Mark => !!m && pick(String(m.attrs.id))
  const markOf = (n: PMNode, t: MarkType) => n.marks.find((m) => m.type === t)

  // 1. Walk the document once: marks come off now (mark steps never move positions); removals are collected.
  const removals: [number, number][] = []
  doc.descendants((node, pos) => {
    if (picked(markOf(node, goes))) {
      removals.push([pos, pos + node.nodeSize])
      return false
    }
    const s = markOf(node, stays)
    if (picked(s)) {
      if (node.isInline) tr.removeMark(pos, pos + node.nodeSize, s)
      else tr.removeNodeMark(pos, s)
      if (node.isText) for (let i = node.text!.indexOf(ZW); i >= 0; i = node.text!.indexOf(ZW, i + 1)) removals.push([pos + i, pos + i + 1])
    }
    const mod = markOf(node, modification)
    if (picked(mod)) {
      if (how === "reject" && !node.isInline) {
        try {
          if (mod.attrs.type === "attr" && typeof mod.attrs.attrName === "string") tr.setNodeAttribute(pos, mod.attrs.attrName, mod.attrs.previousValue)
          else if (mod.attrs.type === "nodeType" && doc.type.schema.nodes[mod.attrs.previousValue]) tr.setNodeMarkup(pos, doc.type.schema.nodes[mod.attrs.previousValue])
          else if (mod.attrs.type === "mark") {
            if (mod.attrs.newValue) tr.removeNodeMark(pos, doc.type.schema.markFromJSON(mod.attrs.newValue))
            if (mod.attrs.previousValue) tr.addNodeMark(pos, doc.type.schema.markFromJSON(mod.attrs.previousValue))
          }
        } catch {
          // an old value the schema no longer accepts: the change stays, the mark still comes off
        }
      }
      const now = tr.doc.nodeAt(pos)
      const still = now?.marks.find((m) => m.type === modification && m.attrs.id === mod.attrs.id)
      if (still) node.isInline ? tr.removeMark(pos, pos + node.nodeSize, still) : tr.removeNodeMark(pos, still)
    }
    return true
  })

  // 2. Suggested breaks and joins, from each textblock's `sb` (normalize.ts records them when the edit is made):
  //    reject a break → this block joins the one before; accept a join → the same; the other two just clear it.
  const inRemoval = (p: number) => removals.some(([a, b]) => p >= a && p < b)
  const joins: number[] = [] // original positions of blocks to join onto the textblock before them
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (!node.attrs.sb || inRemoval(pos)) return false
    let sb: { ins?: string; del?: string }
    try {
      sb = JSON.parse(node.attrs.sb)
    } catch {
      return false
    }
    const join = how === "reject" ? sb.ins : sb.del
    const clear = how === "reject" ? "del" : "ins"
    if (join && pick(join)) joins.push(pos)
    else if (sb[clear] && pick(sb[clear]!)) {
      const rest = { ...sb }
      delete rest[clear]
      tr.setNodeAttribute(pos, "sb", rest.ins || rest.del ? JSON.stringify(rest) : null)
    }
    return false
  })

  // 3. Removals, last first (merged where they touch), then the joins, last first.
  removals.sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const r of removals) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  for (const [from, to] of merged.reverse()) {
    const map = tr.mapping.slice(start)
    const f = map.map(from, 1)
    const t = map.map(to, -1)
    if (t > f) tr.delete(f, t)
  }
  for (const blockPos of joins.reverse()) {
    const map = tr.mapping.slice(start)
    const r = map.mapResult(blockPos, 1)
    if (r.deletedAfter) continue
    const b = tr.doc.nodeAt(r.pos)
    if (!b?.isTextblock) continue
    // the textblock before it, wherever it ends (a sibling, or the last line of the previous list item)
    let endPrev = -1
    tr.doc.nodesBetween(0, r.pos, (node, pos) => {
      if (node.isTextblock && pos + node.nodeSize <= r.pos) endPrev = pos + node.nodeSize - 1
      return !node.isTextblock
    })
    if (endPrev < 0 || !joinable(tr.doc, endPrev, r.pos + 1)) continue
    tr.delete(endPrev, r.pos + 1)
  }
  return tr
}

/** The ids `pick` would resolve, for a confirmation ("Accept 3 suggestions?"). */
export function suggestionIds(doc: PMNode): string[] {
  const ids = new Set<string>()
  const names = new Set(["insertion", "deletion", "modification"])
  doc.descendants((node) => {
    for (const m of node.marks) if (names.has(m.type.name)) ids.add(String(m.attrs.id))
  })
  return [...ids]
}
