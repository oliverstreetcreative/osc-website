// Script documents (SPEC §14 v4): import → ProseMirror JSON, the two ways to read a document (BASE = every pending
// suggestion rejected, ACCEPTED = every one accepted, computed by resolve.ts, the same code behind the editor's
// Accept / Reject buttons, so the render always matches what those buttons would do), and the RENDER the hub, the
// prompter, the PDF and every export share (v4 #7: pending suggestions never leave the editor, so the render is the
// BASE text and says how many suggestions it left out). Server and browser alike; no I/O here.
import type { JSONContent } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"
import * as Y from "yjs"
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap"
import { scriptSchema } from "./schema"
import { isSuggestion, mirrorNodeMarks, restoreNodeMarks } from "./marks"
import { resolveSuggestions } from "./resolve"
import { DEFAULT_WPM, timeRows, timingLabel } from "./timing"

export const YFRAGMENT = "default" // the Y.XmlFragment the editor's Collaboration extension binds to
const ZWSP = /​/g // the suggestion library's invisible anchors at block edges; never words

// ------------------------------------------------------------------------------------------------- import

/** The importer's output (scripts/import_script.py, format "osc-script-import/1"). */
export type ImportRow = {
  video: string[]
  audio: { speaker: string | null; text: string }[]
  directions: string[]
  source?: string
}
export type ImportSuggestion = {
  row: number
  field: "audio" | "speaker"
  start: number // code points (Python str offsets), not UTF-16 units
  end: number
  replace: string
  author?: string
  note?: string
}
export type ScriptImport = {
  format: "osc-script-import/1"
  adapter: string
  title: string
  source: { path: string; sha256: string; label: string }
  rows: ImportRow[]
  suggestions: ImportSuggestion[]
  dropped?: unknown[]
}

type MarkJSON = { type: string; attrs?: Record<string, unknown> }
type Sug = { start: number; end: number; replace: string; id: string }

const para = (content: JSONContent[] = []): JSONContent => (content.length ? { type: "paragraph", content } : { type: "paragraph" })

/** Inline content for `text` with `marks`; a newline becomes a line break carrying the same marks. */
function inlineOf(text: string, marks: MarkJSON[]): JSONContent[] {
  const out: JSONContent[] = []
  text.split("\n").forEach((part, i) => {
    if (i > 0) out.push(marks.length ? { type: "hardBreak", marks } : { type: "hardBreak" })
    if (part) out.push(marks.length ? { type: "text", text: part, marks } : { type: "text", text: part })
  })
  return out
}

/** Text with suggestion ranges as marks: the old words carry a deletion mark, the new ones an insertion (same id). */
function withSuggestions(text: string, sugs: Sug[], base: MarkJSON[] = []): JSONContent[] {
  const cps = Array.from(text) // the importer's offsets count code points
  const out: JSONContent[] = []
  let pos = 0
  for (const s of [...sugs].sort((a, b) => a.start - b.start)) {
    if (s.start < pos || s.end < s.start || s.end > cps.length) throw new Error("a suggestion range doesn't fit its text")
    out.push(...inlineOf(cps.slice(pos, s.start).join(""), base))
    out.push(...inlineOf(cps.slice(s.start, s.end).join(""), [...base, { type: "deletion", attrs: { id: s.id } }]))
    out.push(...inlineOf(s.replace, [...base, { type: "insertion", attrs: { id: s.id } }]))
    pos = s.end
  }
  out.push(...inlineOf(cps.slice(pos).join(""), base))
  return out
}

/**
 * An import as a document. Every suggestion the importer found (the PROMPTER's fixes) becomes a tracked suggestion by
 * `authorCode`, ids "<authorCode>.import.<n>"; the client's own words stay exactly as written (v4 #4).
 */
export function importToPM(imp: ScriptImport, opts: { authorCode: string; rowId?: (i: number) => string }): JSONContent {
  if (imp.format !== "osc-script-import/1") throw new Error(`not an osc-script-import/1 file: ${imp.format}`)
  let n = 0
  const sugs = new Map<string, Sug[]>()
  for (const s of imp.suggestions) {
    const k = `${s.row}:${s.field}`
    sugs.set(k, [...(sugs.get(k) ?? []), { start: s.start, end: s.end, replace: s.replace, id: `${opts.authorCode}.import.${++n}` }])
  }
  for (const k of sugs.keys()) {
    const [row, field] = k.split(":")
    const r = imp.rows[Number(row)]
    if (!r || !r.audio.length) throw new Error(`a suggestion for row ${row} (${field}), which has no audio`)
  }
  const speaker: MarkJSON = { type: "speaker" }
  const rows: JSONContent[] = imp.rows.map((r, i) => {
    const video = r.video.length ? r.video.map((v) => para(inlineOf(v, []))) : [para()]
    const audio: JSONContent[] = r.audio.map((a, k) => {
      const inline: JSONContent[] = []
      const label = a.speaker ?? ""
      const labelSugs = k === 0 ? sugs.get(`${i}:speaker`) ?? [] : []
      if (label) {
        inline.push(...withSuggestions(label, labelSugs, [speaker]), { type: "text", text: ":", marks: [speaker] }, { type: "text", text: " " })
      } else if (labelSugs.length) {
        // A label only the PROMPTER has: the whole "NAME: " is one suggested insertion.
        const id = labelSugs[0].id
        const added = labelSugs.map((s) => s.replace).join("")
        inline.push(
          { type: "text", text: `${added}:`, marks: [speaker, { type: "insertion", attrs: { id } }] },
          { type: "text", text: " ", marks: [{ type: "insertion", attrs: { id } }] },
        )
      }
      inline.push(...withSuggestions(a.text, k === 0 ? sugs.get(`${i}:audio`) ?? [] : []))
      return para(inline)
    })
    for (const d of r.directions) audio.push(para(inlineOf(`(${d})`, [])))
    return {
      type: "avRow",
      attrs: { rowId: opts.rowId ? opts.rowId(i) : null, holdS: null },
      content: [
        { type: "avVideo", content: video },
        { type: "avAudio", content: audio.length ? audio : [para()] },
      ],
    }
  })
  return { type: "doc", content: rows.length ? rows : [para()] }
}

// ------------------------------------------------------------------------------------------------- views

export type View = "base" | "accepted"

/** The document with every pending suggestion rejected (BASE) or accepted (resolve.ts, as the buttons do it). */
export function viewOf(doc: PMNode, view: View): PMNode {
  return resolveSuggestions(new Transform(restoreNodeMarks(doc)), view === "base" ? "reject" : "accept").doc
}

/** Distinct pending suggestions (ids) anywhere in the document, node marks included. */
export function pendingSuggestions(doc: PMNode): number {
  const ids = new Set<string>()
  restoreNodeMarks(doc).descendants((node) => {
    for (const m of node.marks) if (isSuggestion(m)) ids.add(String(m.attrs.id))
  })
  return ids.size
}

// ------------------------------------------------------------------------------------------------- reading

function inline(p: PMNode) {
  let speaker = ""
  let text = ""
  p.forEach((child) => {
    if (child.type.name === "hardBreak") text += "\n"
    else if (child.isText) {
      if (child.marks.some((m) => m.type.name === "speaker")) speaker += child.text ?? ""
      else text += child.text ?? ""
    }
  })
  return { speaker: speaker.replace(ZWSP, "").trim().replace(/:\s*$/, ""), text: text.replace(ZWSP, "") }
}

export type RenderRow = { row_id: string | null; video: string[]; speaker: string | null; audio: string[]; directions: string[]; hold_s: number | null }

/** The AV rows of a CLEAN document (a view). Headings and notes between rows aren't rows: never timed or read. */
export function rowsOf(view: PMNode): RenderRow[] {
  const rows: RenderRow[] = []
  view.forEach((block) => {
    if (block.type.name !== "avRow") return
    const video: string[] = []
    block.child(0).forEach((p) => {
      const t = inline(p).text.trim()
      if (t) video.push(t)
    })
    let speaker: string | null = null
    const audio: string[] = []
    const directions: string[] = []
    block.child(1).forEach((p) => {
      const it = inline(p)
      if (it.speaker && speaker === null) speaker = it.speaker
      const t = (it.speaker ? it.text.replace(/^\s+/, "") : it.text).replace(/\s+$/, "")
      if (!t) return
      const trimmed = t.trim()
      if (/^\([^()]*\)$/.test(trimmed)) directions.push(trimmed.slice(1, -1))
      else audio.push(t)
    })
    const hold = typeof block.attrs.holdS === "number" && block.attrs.holdS > 0 ? block.attrs.holdS : null
    rows.push({ row_id: block.attrs.rowId ?? null, video, speaker, audio, directions, hold_s: hold })
  })
  return rows
}

const DELIVERY = /\((VO|O\/C|OC|V\.O\.|O\.C\.)\)$/

/** The Prompter .txt: AUDIO only, one block per row; a speaker line only when it carries a delivery mark ("(VO)"). */
export function prompterText(rows: RenderRow[]): string {
  const out: string[] = []
  for (const r of rows) {
    if (!r.audio.length) continue
    const body = r.audio.join("\n")
    out.push(r.speaker && DELIVERY.test(r.speaker) ? `${r.speaker}:\n${body}` : body)
  }
  return out.join("\n\n") + "\n"
}

/** Plain text of a view, the thing an approval's hash freezes (v4 #7): VIDEO | AUDIO per row, other blocks as text. */
export function plainText(view: PMNode): string {
  const out: string[] = []
  view.forEach((block) => {
    if (block.type.name === "avRow") {
      const cell = (n: PMNode) => {
        const lines: string[] = []
        n.forEach((p) => {
          const it = inline(p)
          lines.push(it.speaker ? `${it.speaker}: ${it.text.replace(/^\s+/, "")}` : it.text)
        })
        return lines.join("\n")
      }
      out.push(`VIDEO: ${cell(block.child(0))}\nAUDIO: ${cell(block.child(1))}`)
    } else out.push(block.textBetween(0, block.content.size, "\n", "\n").replace(ZWSP, ""))
  })
  return out.join("\n\n") + "\n"
}

export type ScriptRender = {
  rows: (RenderRow & { seconds: number | null })[]
  words: number
  blanks: number
  untimed_rows: number
  total_s: number
  label: string
  pace_wpm: number
  target_s: number | null
  pending_suggestions: number
  prompter_text: string
}

/** THE render (hub, prompter, PDF, exports): the BASE text, timed, with the count of suggestions it left out. */
export function renderScript(doc: PMNode, opts: { wpm?: number; target_s?: number | null; view?: View } = {}): ScriptRender {
  const rows = rowsOf(viewOf(doc, opts.view ?? "base"))
  const wpm = opts.wpm ?? DEFAULT_WPM
  const t = timeRows(rows.map((r) => ({ audio: r.audio.map((text) => ({ text })), hold_s: r.hold_s })), wpm)
  return {
    rows: rows.map((r, i) => ({ ...r, seconds: t.rows[i]?.seconds ?? null })),
    words: t.words,
    blanks: t.blanks,
    untimed_rows: t.untimed_rows,
    total_s: t.total_s,
    label: timingLabel(t.total_s, opts.target_s ?? null, t.blanks),
    pace_wpm: wpm,
    target_s: opts.target_s ?? null,
    pending_suggestions: pendingSuggestions(doc),
    prompter_text: prompterText(rows),
  }
}

// ------------------------------------------------------------------------------------------------- Yjs

export const pmFromJSON = (json: JSONContent) => scriptSchema().nodeFromJSON(json)

/** A fresh Yjs document holding `json` (node-level suggestion marks mirrored into `sm` first, so they survive). */
export function yDocFromJSON(json: JSONContent): Y.Doc {
  return prosemirrorJSONToYDoc(scriptSchema(), mirrorNodeMarks(pmFromJSON(json)).toJSON(), YFRAGMENT)
}

/** The ProseMirror document a Yjs document holds, node-level suggestion marks restored from `sm`.
 *  NOTE: y-tiptap DELETES (in that Y.Doc) any element the schema rejects while converting; use pmSnapshot() on a
 *  document that must only change through committed updates (the server's live copy). */
export function pmFromYDoc(doc: Y.Doc): PMNode {
  return restoreNodeMarks(yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(YFRAGMENT), scriptSchema()))
}

/** A copy of a Yjs document (same content; changing it never touches the original). */
export function cloneYDoc(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc({ gc: true })
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  return copy
}

/** pmFromYDoc on a copy: reading never changes the document read. */
export const pmSnapshot = (doc: Y.Doc): PMNode => pmFromYDoc(cloneYDoc(doc))
