// The SCRIPT document schema (SPEC §14 v4), shared by the editor (browser) and the server (render, guard, import,
// exports) so both build the SAME ProseMirror schema. No browser-only or server-only imports here.
//
//   doc        block+                     (block = paragraph | heading | lists | avRow)
//   avRow      avVideo avAudio            attrs: rowId, holdS (a VIDEO hold in seconds, e.g. an end card)
//   avVideo    paragraph+                 what's on screen
//   avAudio    paragraph+                 what's heard; a leading "NAME:" carries the `speaker` mark; a paragraph that
//                                         is wholly "( … )" is a direction (never read, never on the prompter)
// Suggest mode (@handlewithcare/prosemirror-suggest-changes): the marks `insertion`, `deletion`, `modification`, on
// text AND on blocks (every container allows them on its children). Suggestion ids are strings
// "<person>.<yjs clientID>.<n>", so the author is in the id and the server's guard can check it.
import { Extension, Mark, Node, getSchema, mergeAttributes, type AnyExtension } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"

export const SUGGESTION_MARKS = "insertion modification deletion"

const ScriptDoc = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",
  marks: SUGGESTION_MARKS,
})

const AvRow = Node.create({
  name: "avRow",
  group: "block",
  content: "avVideo avAudio",
  marks: SUGGESTION_MARKS,
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      rowId: { default: null, parseHTML: (el) => el.getAttribute("data-row-id"), renderHTML: (a) => (a.rowId ? { "data-row-id": a.rowId } : {}) },
      holdS: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-hold-s")
          return v ? Number(v) : null
        },
        renderHTML: (a) => (a.holdS ? { "data-hold-s": String(a.holdS) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div.av-row" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "av-row" }), 0]
  },
})

const AvVideo = Node.create({
  name: "avVideo",
  content: "paragraph+",
  marks: SUGGESTION_MARKS,
  isolating: true,
  parseHTML() {
    return [{ tag: "div.av-video" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "av-video", "data-label": "VIDEO" }), 0]
  },
})

const AvAudio = Node.create({
  name: "avAudio",
  content: "paragraph+",
  marks: SUGGESTION_MARKS,
  isolating: true,
  parseHTML() {
    return [{ tag: "div.av-audio" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "av-audio", "data-label": "AUDIO" }), 0]
  },
})

/** The speaker label at the start of an AUDIO paragraph ("MIKE:", "NARRATOR (VO):"). Never read aloud. */
const Speaker = Mark.create({
  name: "speaker",
  inclusive: false,
  parseHTML() {
    return [{ tag: "span.s-speaker" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "s-speaker" }), 0]
  },
})

// The suggestion marks, as TipTap marks with the library's names and attributes (its commands look them up by name).
const idAttr = {
  id: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const raw = el.getAttribute("data-id")
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    },
    renderHTML: (a: Record<string, unknown>) => ({ "data-id": JSON.stringify(a.id) }),
  },
}

const Insertion = Mark.create({
  name: "insertion",
  inclusive: false,
  excludes: "deletion modification insertion",
  addAttributes() {
    return idAttr
  },
  parseHTML() {
    return [{ tag: "ins[data-id]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["ins", mergeAttributes(HTMLAttributes, { class: "s-ins" }), 0]
  },
})

const Deletion = Mark.create({
  name: "deletion",
  inclusive: false,
  excludes: "insertion modification deletion",
  addAttributes() {
    return idAttr
  },
  parseHTML() {
    return [{ tag: "del[data-id]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["del", mergeAttributes(HTMLAttributes, { class: "s-del" }), 0]
  },
})

const Modification = Mark.create({
  name: "modification",
  inclusive: false,
  excludes: "deletion insertion",
  addAttributes() {
    return {
      ...idAttr,
      type: { default: null, rendered: false },
      attrName: { default: null, rendered: false },
      previousValue: { default: null, rendered: false },
      newValue: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-type=modification]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "s-mod", "data-type": "modification" }), 0]
  },
})

/** Lists may hold suggested (inserted/deleted) items too. */
const ListSuggestions = Extension.create({
  name: "listSuggestions",
  extendNodeSchema(extension) {
    // Container nodes allow NO marks on their children unless told (ProseMirror's default), so a suggested list item
    // couldn't carry its insertion mark without this.
    return ["bulletList", "orderedList", "listItem"].includes(extension.name) ? { marks: SUGGESTION_MARKS } : {}
  },
})

/** Every node that can carry a suggestion as a NODE mark (a whole suggested row, paragraph, list item, line break). */
export const SM_NODE_TYPES = ["avRow", "avVideo", "avAudio", "paragraph", "heading", "bulletList", "orderedList", "listItem", "hardBreak"]

/**
 * The `sm` attribute: a node's suggestion marks, mirrored as JSON. y-tiptap syncs node ATTRIBUTES but drops node
 * MARKS (checked in its 3.0.9 source: createTypeFromElementNode / createNodeFromYElement copy attrs only), so without
 * this a suggested new row would reach every other phone, and the server, as a direct edit. marks.ts keeps the two in
 * step: local changes write the attribute, remote ones restore the marks.
 */
const SuggestionAttr = Extension.create({
  name: "suggestionAttr",
  addGlobalAttributes() {
    return [
      { types: SM_NODE_TYPES, attributes: { sm: { default: null, rendered: false, keepOnSplit: false } } },
      // `sb` (suggested boundary), on a textblock: JSON {ins?: id, del?: id}. ins = the break BEFORE this block was
      // suggested (Enter, a pasted line), so rejecting it joins this block back onto the one before; del = removing
      // that break was suggested (Backspace at a line start), so accepting it joins them. Set by normalize.ts when the
      // edit is made; the library's zero-width anchors alone get disturbed by later edits (seed 6, 10/3).
      { types: ["paragraph", "heading"], attributes: { sb: { default: null, rendered: false, keepOnSplit: false } } },
    ]
  },
})

/** Every extension that shapes the document (no collaboration, no UI): the editor adds its own on top. */
export function scriptExtensions(): AnyExtension[] {
  return [
    ScriptDoc,
    StarterKit.configure({
      document: false,
      undoRedo: false, // Yjs's undo manager takes over under collaboration
      codeBlock: false,
      code: false,
      blockquote: false,
      horizontalRule: false,
      link: false,
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
    }),
    AvRow,
    AvVideo,
    AvAudio,
    Speaker,
    Insertion,
    Deletion,
    Modification,
    ListSuggestions,
    SuggestionAttr,
  ]
}

let cached: ReturnType<typeof getSchema> | null = null
/** The ProseMirror schema (built once). */
export function scriptSchema() {
  if (!cached) cached = getSchema(scriptExtensions())
  return cached
}
