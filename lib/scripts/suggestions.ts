// The pending suggestions in a document, summarised for the editor's list ("Sam: Im → I’m"). Server and browser.
import type { Node as PMNode } from "@tiptap/pm/model"
import { ownerOf, restoreNodeMarks } from "./marks"

export type SuggestionSummary = {
  id: string
  owner: string | null
  inserted: string
  deleted: string
  rowsAdded: number
  rowsRemoved: number
  breaks: number // suggested new lines
  joins: number // suggested joins of two lines
  firstPos: number
}

const ZW = /​/g

export function listSuggestions(input: PMNode): SuggestionSummary[] {
  const doc = restoreNodeMarks(input)
  const by = new Map<string, SuggestionSummary>()
  const get = (id: string, pos: number) => {
    let s = by.get(id)
    if (!s) {
      s = { id, owner: ownerOf(id), inserted: "", deleted: "", rowsAdded: 0, rowsRemoved: 0, breaks: 0, joins: 0, firstPos: pos }
      by.set(id, s)
    }
    return s
  }
  doc.descendants((node, pos) => {
    for (const m of node.marks) {
      if (m.type.name !== "insertion" && m.type.name !== "deletion") continue
      const s = get(String(m.attrs.id), pos)
      const ins = m.type.name === "insertion"
      if (node.type.name === "avRow") {
        if (ins) s.rowsAdded++
        else s.rowsRemoved++
        return false
      }
      if (!node.isInline) {
        const text = node.textContent.replace(ZW, "")
        if (ins) s.inserted += (s.inserted ? " " : "") + text
        else s.deleted += (s.deleted ? " " : "") + text
        return false
      }
      const text = node.isText ? node.text!.replace(ZW, "") : node.type.name === "hardBreak" ? " " : ""
      if (ins) s.inserted += text
      else s.deleted += text
    }
    if (node.isTextblock && typeof node.attrs.sb === "string" && node.attrs.sb) {
      try {
        const sb = JSON.parse(node.attrs.sb) as { ins?: string; del?: string }
        if (sb.ins) get(sb.ins, pos).breaks++
        if (sb.del) get(sb.del, pos).joins++
      } catch {
        // unreadable: nothing to list
      }
    }
    return true
  })
  return [...by.values()].sort((a, b) => a.firstPos - b.firstPos)
}

/** One line a person can read: "Im → I’m", "adds “really”", "removes “big”", "a new row". */
export function describe(s: SuggestionSummary): string {
  const parts: string[] = []
  const ins = s.inserted.trim()
  const del = s.deleted.trim()
  if (ins && del) parts.push(`${del} → ${ins}`)
  else if (ins) parts.push(`adds “${ins}”`)
  else if (del) parts.push(`removes “${del}”`)
  if (s.rowsAdded) parts.push(s.rowsAdded === 1 ? "a new row" : `${s.rowsAdded} new rows`)
  if (s.rowsRemoved) parts.push(s.rowsRemoved === 1 ? "removes a row" : `removes ${s.rowsRemoved} rows`)
  if (s.breaks) parts.push("a new line")
  if (s.joins) parts.push("joins two lines")
  return parts.join(" · ") || "a change"
}
