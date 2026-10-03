// The server's suggester guard (SPEC §14 v4 #5): may this change from a person with the SUGGESTER role go in?
// The editor's normalize.ts keeps honest browsers inside these rules; this module enforces them on whatever arrives.
//
// One rule, checked with the same accept/reject code the buttons use (resolve.ts):
//   - the BASE (every suggestion rejected) is unchanged: they changed no words directly, accepted nothing;
//   - for every OTHER person P, the document with only P's suggestions accepted is unchanged: nobody else's
//     suggestion lost a word, gained one, or changed hands (typing inside P's suggestion is fine: theirs, not P's);
//   - every suggestion id that is new in this change is theirs: their person code and a Yjs clientID bound to them.
// Plus, at the Yjs level: every struct in the update was made by the clientID they posted (bound to them), and the
// update applies completely (no pending structs).
import type { Node as PMNode } from "@tiptap/pm/model"
import { Transform } from "@tiptap/pm/transform"
import * as Y from "yjs"
import { ownerOf, restoreNodeMarks } from "./marks"
import { resolveSuggestions } from "./resolve"
import { pmFromYDoc } from "./doc"

export type Verdict = { ok: true } | { ok: false; why: string }
export type Suggester = { code: string; clientIds: ReadonlySet<string> }

const ZW = /​/g
const SUGGESTION = new Set(["insertion", "deletion", "modification"])

/** A document as comparable JSON: no anchors, no suggestion bookkeeping attributes (sm, sb). */
function key(doc: PMNode): string {
  return JSON.stringify(doc.toJSON(), (k, v) => {
    if ((k === "sm" || k === "sb") && v === null) return undefined
    if (k === "sm" || k === "sb") return undefined
    if (k === "text" && typeof v === "string") return v.replace(ZW, "")
    return v
  })
}

/** Every suggestion id in a document (marks, node marks via `sm`, and suggested breaks in `sb`), with its owner. */
export function suggestionIdsIn(doc: PMNode): Set<string> {
  const ids = new Set<string>()
  restoreNodeMarks(doc).descendants((node) => {
    for (const m of node.marks) if (SUGGESTION.has(m.type.name) && m.attrs.id != null) ids.add(String(m.attrs.id))
    if (typeof node.attrs.sb === "string" && node.attrs.sb) {
      try {
        const sb = JSON.parse(node.attrs.sb) as Record<string, unknown>
        for (const v of Object.values(sb)) if (typeof v === "string") ids.add(v)
      } catch {
        ids.add("\u0000unreadable")
      }
    }
  })
  return ids
}

/** The document with only `owner`'s suggestions accepted (null = none: the base). */
function viewFor(doc: PMNode, owner: string | null): string {
  const restored = restoreNodeMarks(doc)
  const tr = new Transform(restored)
  if (owner) resolveSuggestions(tr, "accept", (id) => ownerOf(id) === owner)
  resolveSuggestions(tr, "reject", () => true)
  return key(tr.doc)
}

/** The ProseMirror-level check: prev and next are the documents before and after the change. */
export function checkSuggester(prev: PMNode, next: PMNode, who: Suggester): Verdict {
  const before = suggestionIdsIn(prev)
  const after = suggestionIdsIn(next)
  for (const id of after) {
    if (before.has(id)) continue
    const [code, client] = id.split(".")
    if (code !== who.code) return { ok: false, why: `a new suggestion under someone else's name (${id})` }
    if (!who.clientIds.has(client)) return { ok: false, why: `a suggestion from a session that isn't theirs (${id})` }
  }
  if (viewFor(prev, null) !== viewFor(next, null)) return { ok: false, why: "it changes the words directly instead of suggesting" }
  const others = new Set<string>()
  for (const id of [...before, ...after]) {
    const o = ownerOf(id)
    if (o && o !== who.code) others.add(o)
  }
  for (const o of others) {
    if (viewFor(prev, o) !== viewFor(next, o)) return { ok: false, why: "it changes someone else's suggestion" }
  }
  return { ok: true }
}

/** The distinct Yjs clientIDs whose structs an update carries, or null if it can't be read. */
export function updateClients(update: Uint8Array): number[] | null {
  try {
    return [...new Set(Y.decodeUpdate(update).structs.map((s) => s.id.client))]
  } catch {
    return null
  }
}

/**
 * The Yjs-level check for one update, for EVERY role: its structs all come from clientIDs bound to the sender
 * (`ownClients`; the route binds them first), and it applies completely (no pending structs). For a SUGGESTER (`who`
 * set) the document-level rule above runs too. Never mutates `doc`.
 */
export function checkUpdate(doc: Y.Doc, update: Uint8Array, ownClients: ReadonlySet<number>, who: Suggester | null): Verdict {
  const clients = updateClients(update)
  if (!clients) return { ok: false, why: "an update that can't be read" }
  if (clients.some((c) => !ownClients.has(c))) return { ok: false, why: "an update with another session's changes in it" }
  const trial = new Y.Doc({ gc: true })
  Y.applyUpdate(trial, Y.encodeStateAsUpdate(doc))
  const prev = who ? pmFromYDoc(trial) : null
  try {
    Y.applyUpdate(trial, update)
  } catch {
    return { ok: false, why: "an update that can't be applied" }
  }
  const store = trial.store as unknown as { pendingStructs: unknown; pendingDs: unknown }
  if (store.pendingStructs || store.pendingDs) return { ok: false, why: "an update that depends on changes we don't have" }
  return who ? checkSuggester(prev!, pmFromYDoc(trial), who) : { ok: true }
}

/** One suggester update from one browser session (tests; the route uses checkUpdate with every bound clientID). */
export function checkSuggesterUpdate(doc: Y.Doc, update: Uint8Array, clientId: number, who: Suggester): Verdict {
  return checkUpdate(doc, update, new Set([clientId]), who)
}
