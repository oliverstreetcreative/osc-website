// Suggestion marks: who owns an id, and the node-mark ↔ `sm` attribute mirror (see schema.ts SuggestionAttr: y-tiptap
// syncs node attributes but drops node marks, so a whole suggested row rides in its `sm` attribute and gets its marks
// back wherever the document is rebuilt from Yjs: the other phones, the server's guard, the render).
import type { Mark, Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Transform } from "@tiptap/pm/transform"
import { ySyncPluginKey } from "@tiptap/y-tiptap"

export const SUGGESTION_TYPES = new Set(["insertion", "deletion", "modification"])
export const isSuggestion = (m: Mark) => SUGGESTION_TYPES.has(m.type.name)

/** Suggestion ids are "<person code>.<yjs clientID>.<n>" (imports: "<person code>.import.<n>"). */
export function ownerOf(id: unknown): string | null {
  if (typeof id !== "string") return null
  const dot = id.indexOf(".")
  return dot > 0 ? id.slice(0, dot) : null
}

/** A person's code in suggestion ids: the first 8 hex digits of their id (stable, short, no dashes). */
export const personCode = (personId: string) => personId.replace(/-/g, "").slice(0, 8).toLowerCase()

/** The `sm` value for a node's marks: its suggestion marks as JSON, or null when it has none. */
export function smOf(marks: readonly Mark[]): string | null {
  const s = marks.filter(isSuggestion).map((m) => m.toJSON())
  return s.length ? JSON.stringify(s) : null
}

const hasSm = (node: PMNode) => !node.isText && Object.prototype.hasOwnProperty.call(node.attrs, "sm")

/** Give `node` (at `pos` in tr.doc) exactly the suggestion marks its `sm` attribute lists. */
function marksFromSm(tr: Transform, pos: number, node: PMNode) {
  const schema = node.type.schema
  let want: Mark[] = []
  if (typeof node.attrs.sm === "string" && node.attrs.sm) {
    try {
      want = (JSON.parse(node.attrs.sm) as unknown[]).flatMap((j) => {
        try {
          const m = schema.markFromJSON(j)
          return isSuggestion(m) ? [m] : []
        } catch {
          return []
        }
      })
    } catch {
      want = []
    }
  }
  for (const m of node.marks) if (isSuggestion(m) && !m.isInSet(want)) tr.removeNodeMark(pos, m)
  for (const m of want) if (!m.isInSet(node.marks)) tr.addNodeMark(pos, m)
}

/**
 * A document rebuilt from Yjs gets its node-level suggestion marks back from `sm` (server: guard, render, exports).
 * A node that already HAS suggestion marks keeps them: it came from the editor or from code, where marks are the
 * truth and `sm` may lag. (Yjs never rebuilds a node with marks, so on the server `sm` is the only source.)
 */
export function restoreNodeMarks(doc: PMNode): PMNode {
  const tr = new Transform(doc)
  doc.descendants((node, pos) => {
    if (hasSm(node) && node.attrs.sm && !node.marks.some(isSuggestion)) marksFromSm(tr, pos, node)
  })
  return tr.doc
}

/** The other way: every `sm` attribute set from the node's marks (a document built in code before it goes to Yjs). */
export function mirrorNodeMarks(doc: PMNode): PMNode {
  const tr = new Transform(doc)
  doc.descendants((node, pos) => {
    if (!hasSm(node)) return
    const want = smOf(node.marks)
    if (want !== (node.attrs.sm ?? null)) tr.setNodeAttribute(pos, "sm", want)
  })
  return tr.doc
}

export const nodeMarkSyncKey = new PluginKey("oscNodeMarkSync")

/**
 * The editor half: after a LOCAL change (typing, a suggestion, accept/reject), write each node's marks into `sm` so
 * y-tiptap ships them; after a REMOTE change (y-sync rebuilt nodes from Yjs, marks gone), put the marks back from
 * `sm`. Restoring marks makes no Yjs change (y-tiptap ignores node marks), so the two directions can't echo.
 */
export function nodeMarkSync() {
  return new Plugin({
    key: nodeMarkSyncKey,
    appendTransaction(trs, _old, state) {
      if (!trs.some((t) => t.docChanged)) return null
      const remote = trs.some((t) => t.getMeta(ySyncPluginKey))
      const tr = state.tr
      state.doc.descendants((node, pos) => {
        if (!hasSm(node)) return
        const want = smOf(node.marks)
        if (want === (node.attrs.sm ?? null)) return
        if (remote) marksFromSm(tr, pos, node)
        else tr.setNodeAttribute(pos, "sm", want)
      })
      if (!tr.docChanged) return null
      tr.setMeta("addToHistory", false)
      tr.setMeta(nodeMarkSyncKey, remote ? "marks" : "attrs")
      return tr
    },
  })
}
