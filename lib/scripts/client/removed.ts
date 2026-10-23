// Words this session typed that someone else's change just removed (SPEC §14 v4 #13; built review #2): a restore, or
// an accepted deletion / rejected row, landing on a block while you were typing in it. Yjs emits `afterTransaction`
// BEFORE it garbage-collects deleted content (yjs 13.6 cleanupTransactions), so the deleted items still hold their
// text there. Pure: works on any Y.Doc (tests run it in Node).
import * as Y from "yjs"

const ZW = /​/g

/** The text of `clientId`'s items that `tr` deleted, in document order of deletion ranges ("" if none). */
export function wordsRemoved(tr: Y.Transaction, clientId: number, typedSince?: number): string {
  if (!tr.deleteSet.clients.has(clientId)) return ""
  let out = ""
  Y.iterateDeletedStructs(tr, tr.deleteSet, (struct) => {
    if (struct.id.client !== clientId || !(struct instanceof Y.Item)) return
    if (typedSince !== undefined && struct.id.clock < typedSince) return // older words: an intended removal
    if (struct.content instanceof Y.ContentString) out += struct.content.str
  })
  return out.replace(ZW, "").trim()
}

/** Remembers when this session's clock passed each point, so "typed in the last minute" is a clock bound. */
export class TypingClock {
  private marks: { clock: number; at: number }[] = []
  constructor(private readonly doc: Y.Doc) {}
  /** Call after every LOCAL transaction. */
  note() {
    const clock = Y.getState(this.doc.store, this.doc.clientID)
    const last = this.marks[this.marks.length - 1]
    if (!last || last.clock !== clock) this.marks.push({ clock, at: Date.now() })
    const cutoff = Date.now() - 10 * 60_000
    while (this.marks.length > 1 && this.marks[0].at < cutoff) this.marks.shift()
  }
  /** The lowest clock typed within the last `ms` (items at or above it are recent). */
  since(ms: number): number {
    const cutoff = Date.now() - ms
    let clock = Y.getState(this.doc.store, this.doc.clientID)
    for (let i = this.marks.length - 1; i >= 0; i--) {
      if (this.marks[i].at < cutoff) break
      clock = i > 0 ? this.marks[i - 1].clock : 0
    }
    return clock
  }
}
