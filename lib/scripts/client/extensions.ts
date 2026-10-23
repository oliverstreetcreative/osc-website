// TipTap extensions for the script editor. Browser only (imported by the editor component).
import { Extension } from "@tiptap/core"
import { Selection, TextSelection } from "@tiptap/pm/state"
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model"
import { ySyncPluginKey } from "@tiptap/y-tiptap"
import { suggestChanges } from "@handlewithcare/prosemirror-suggest-changes"
import { nodeMarkSync } from "../marks"
import { suggestEdit, type Author } from "../normalize"

/** Meta on accept/reject transactions: they ARE the resolution, never tracked as suggestions. */
export const RESOLVE_META = "oscResolve"

/** Node-level suggestion marks ↔ the `sm` attribute Yjs carries (marks.ts). */
export const NodeMarkSync = Extension.create({
  name: "oscNodeMarkSync",
  addProseMirrorPlugins() {
    return [nodeMarkSync()]
  },
})

export type SuggestModeOptions = {
  active: () => boolean
  author: () => Author | null
  nextId: () => string
  onRefuse: (why: string) => void
}

/**
 * Suggest mode (SPEC §14 v4 #5, v5): every local edit goes through normalize.ts's suggestEdit, which tracks it as the
 * author's suggestion or refuses it with a reason. Remote and undo transactions (y-sync) and accept/reject pass as is.
 */
export const SuggestMode = Extension.create<SuggestModeOptions>({
  name: "oscSuggestMode",
  addOptions() {
    return { active: () => false, author: () => null, nextId: () => "", onRefuse: () => undefined }
  },
  addProseMirrorPlugins() {
    return [suggestChanges()] // the library's pilcrow marks at suggested breaks, and arrow keys stepping over its anchors
  },
  dispatchTransaction({ transaction, next }) {
    const me = this.options.author()
    if (!transaction.docChanged || !me || !this.options.active() || transaction.getMeta(ySyncPluginKey) || transaction.getMeta(RESOLVE_META)) {
      next(transaction)
      return
    }
    const res = suggestEdit(this.editor.state, transaction, me, this.options.nextId)
    if (res.ok) next(res.tr)
    else this.options.onRefuse(res.why)
  },
})

function cellDepth($pos: ResolvedPos) {
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d).type.name
    if (n === "avVideo" || n === "avAudio") return d
  }
  return -1
}

function rowDepth($pos: ResolvedPos) {
  for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.name === "avRow") return d
  return -1
}

export const emptyRow = (schema: import("@tiptap/pm/model").Schema, rowId: string): PMNode =>
  schema.nodes.avRow.create({ rowId }, [
    schema.nodes.avVideo.create(null, schema.nodes.paragraph.create()),
    schema.nodes.avAudio.create(null, schema.nodes.paragraph.create()),
  ])

/** Tab / Shift-Tab between the VIDEO and AUDIO boxes; Mod-Enter adds a row below. */
export const AvKeys = Extension.create<{ newRowId: () => string }>({
  name: "oscAvKeys",
  addOptions() {
    return { newRowId: () => crypto.randomUUID() }
  },
  addKeyboardShortcuts() {
    const move = (dir: 1 | -1) => () => {
      const { state, view } = this.editor
      const $from = state.selection.$from
      const d = cellDepth($from)
      if (d < 0) return false
      const edge = dir > 0 ? $from.after(d) : $from.before(d)
      const target = Selection.findFrom(state.doc.resolve(edge), dir, true)
      if (!target) return true
      view.dispatch(state.tr.setSelection(dir > 0 ? target : TextSelection.near(state.doc.resolve(target.from), -1)).scrollIntoView())
      return true
    }
    return {
      Tab: move(1),
      "Shift-Tab": move(-1),
      "Mod-Enter": () => {
        const { state, view } = this.editor
        const d = rowDepth(state.selection.$from)
        const at = d > 0 ? state.selection.$from.after(d) : state.doc.content.size
        const tr = state.tr.insert(at, emptyRow(state.schema, this.options.newRowId()))
        const sel = Selection.findFrom(tr.doc.resolve(at + 1), 1, true)
        if (sel) tr.setSelection(sel)
        view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },
})
