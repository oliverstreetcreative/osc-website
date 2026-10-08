// The browser's half of the live transport (SPEC §14 Spike A; v4 #1 "no lost words"). Browser only.
//
// Listens on /api/scripts/<id>/events (Server-Sent Events) and POSTs local changes to /updates. A local change stays
// in an OUTBOX until the server answers with its seq. The outbox is kept on the device per script, PERSON and TAB (so
// one tab's save never erases another's, and a second account in the same browser never inherits it); a new tab takes
// over what earlier tabs of the same person left. On every reconnect the outbox goes again, plus anything the server's
// state vector says it lacks (an earlier visit's offline typing, kept by y-indexeddb, also per person). The page
// flushes when hidden; a stream silent for a minute is replaced. Failures back off; a refusal (409, or a change too
// large or unreadable) freezes editing at once, hands the person's words back and starts again from the server's copy.
// Words this tab typed that someone else's change removes at the same moment are handed back too (v4 #13).
import * as Y from "yjs"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"
import { IndexeddbPersistence } from "y-indexeddb"
import { TypingClock, wordsRemoved } from "./removed"

export type SaveState = "connecting" | "saved" | "saving" | "offline" | "read-only"
export type SyncInfo = { role: "viewer" | "commenter" | "suggester" | "editor"; readOnly: string | null; me: { code: string; name: string } }
export type SyncHooks = {
  /** The server refused the change: the tab is frozen; remount from the server's copy and show `why`. */
  onRefused: (why: string) => void
  /** Someone else's change removed words this tab typed in the last minute. */
  onWordsRemoved: (words: string) => void
}

function b64(u: Uint8Array) {
  let s = ""
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hasStructs = (u: Uint8Array) => {
  try {
    return Y.decodeUpdate(u).structs.length > 0
  } catch {
    return false
  }
}
const FROM_OUTBOX = Symbol("outbox") // applying a stored outbox locally: never re-queued
const MAX_SV_CHARS = 4000 // a state vector grows by one entry per editing session; past this, ask for everything

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export class ScriptSync {
  readonly doc = new Y.Doc()
  readonly awareness: Awareness
  state: SaveState = "connecting"
  info: SyncInfo | null = null
  /** The server stopped us: access ended, or the script is gone. */
  ended: string | null = null
  /** Set the moment a change is refused: nothing more is taken from this tab. */
  frozen = false
  /** Bumps whenever the server says comments changed (the comments panel re-reads with its own filter). */
  commentsVersion = 0

  private es: EventSource | null = null
  private sub: string | null = null
  private outbox: Uint8Array[] = []
  private inFlight = 0 // outbox items the current POST carries
  private retry = 0 // stream reconnects
  private postRetry = 0 // failed saves in a row
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private presenceTimer: ReturnType<typeof setInterval> | null = null
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null
  private watchdog: ReturnType<typeof setInterval> | null = null
  private local: IndexeddbPersistence | null = null
  private listeners = new Set<() => void>()
  private destroyed = false
  private lastHeard = 0 // when the stream last said anything (the server pings every 20 s)
  private readonly outboxPrefix: string
  private readonly outboxKey: string
  private readonly typing: TypingClock

  constructor(
    readonly scriptId: string,
    readonly meCode: string,
    private readonly hooks: SyncHooks,
  ) {
    this.awareness = new Awareness(this.doc)
    this.typing = new TypingClock(this.doc)
    this.outboxPrefix = `osc-script-outbox-${scriptId}-${meCode}-`
    this.outboxKey = `${this.outboxPrefix}${this.doc.clientID}`
    this.doc.on("update", this.onDocUpdate)
    this.doc.on("afterTransaction", this.onAfterTransaction)
    this.awareness.on("update", this.onAwarenessUpdate)
    try {
      this.local = new IndexeddbPersistence(`osc-script-${scriptId}-${meCode}`, this.doc)
      this.local.whenSynced.then(this.start).catch(this.start)
    } catch {
      this.start()
    }
    window.addEventListener("online", this.reconnectNow)
    document.addEventListener("visibilitychange", this.onVisibility)
    this.presenceTimer = setInterval(() => this.sendAwareness(), 15_000)
    // A stream can die without an error (a phone asleep, Safari in the background): if it's been silent for a
    // minute, start a new one (the sync on reconnect fills in whatever was missed both ways).
    this.watchdog = setInterval(() => {
      if (this.es && this.lastHeard && Date.now() - this.lastHeard > 60_000) this.restart()
    }, 15_000)
  }

  /** After the device copy loads: take over what earlier tabs of this person left unsaved, then connect. */
  private start = () => {
    const ls = storage()
    if (ls) {
      const taken: Uint8Array[] = []
      for (let i = ls.length - 1; i >= 0; i--) {
        const key = ls.key(i)
        if (!key || !key.startsWith(this.outboxPrefix) || key === this.outboxKey) continue
        try {
          const saved = ls.getItem(key)
          if (saved) taken.push(fromB64(saved))
          ls.removeItem(key)
        } catch {
          // unreadable: leave it
        }
      }
      if (taken.length) {
        const merged = Y.mergeUpdates(taken)
        Y.applyUpdate(this.doc, merged, FROM_OUTBOX) // so those words show here now, not after a reconnect
        this.outbox.push(merged)
        this.persistOutbox()
      }
    }
    this.connect()
  }

  private restart() {
    this.es?.close()
    this.es = null
    this.sub = null
    this.clearReconnect()
    this.retry = 0
    this.connect()
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() {
    for (const fn of this.listeners) fn()
  }
  private setState(s: SaveState) {
    if (this.state !== s) {
      this.state = s
      this.emit()
    }
  }
  get canWrite() {
    return !this.frozen && !this.ended && !!this.info && !this.info.readOnly && (this.info.role === "suggester" || this.info.role === "editor")
  }

  // ------------------------------------------------------------------ incoming

  private connect = () => {
    if (this.destroyed) return
    this.clearReconnect()
    this.es?.close()
    const sv = b64(Y.encodeStateVector(this.doc))
    const es = new EventSource(`/api/scripts/${this.scriptId}/events${sv.length <= MAX_SV_CHARS ? `?sv=${encodeURIComponent(sv)}` : ""}`)
    this.es = es
    this.lastHeard = Date.now()
    const heard = () => {
      if (this.es === es) this.lastHeard = Date.now()
    }
    for (const name of ["sync", "update", "awareness", "left", "comments", "ping"]) es.addEventListener(name, heard)
    es.addEventListener("sync", (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      this.retry = 0
      this.sub = d.sub
      this.info = { role: d.role, readOnly: d.read_only, me: d.me }
      Y.applyUpdate(this.doc, fromB64(d.update), this)
      for (const p of d.presence ?? []) applyAwarenessUpdate(this.awareness, fromB64(p), "remote")
      if (this.canWrite) {
        // what this device has that the server lacks (an earlier visit's offline typing)
        const missing = Y.encodeStateAsUpdate(this.doc, fromB64(d.sv))
        if (hasStructs(missing)) this.addToOutbox(missing)
      } else if (!this.frozen) {
        this.outbox = []
        this.persistOutbox()
      }
      this.setState(this.canWrite ? (this.outbox.length ? "saving" : "saved") : "read-only")
      this.sendAwareness()
      this.flush()
    })
    es.addEventListener("update", (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      Y.applyUpdate(this.doc, fromB64(d.update), this)
    })
    es.addEventListener("awareness", (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      applyAwarenessUpdate(this.awareness, fromB64(d.update), "remote")
    })
    es.addEventListener("left", (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      if (typeof d.client === "number" && d.client !== this.doc.clientID) removeAwarenessStates(this.awareness, [d.client], "remote")
    })
    es.addEventListener("comments", () => {
      this.commentsVersion++
      this.emit()
    })
    es.addEventListener("revoked", () => {
      this.ended = "Your access to this script has ended."
      this.emit()
      this.destroy()
    })
    es.onerror = () => {
      es.close()
      if (this.es !== es || this.destroyed) return
      this.es = null
      this.sub = null
      this.setState(this.info && !this.canWrite ? "read-only" : "offline")
      const wait = [1000, 2000, 5000, 10_000, 30_000][Math.min(this.retry++, 4)]
      this.clearReconnect()
      this.reconnectTimer = setTimeout(this.connect, wait)
    }
  }

  private reconnectNow = () => {
    if (this.destroyed) return
    // a stream that's open and has spoken in the last 45 s is fine; anything else starts over
    if (this.es && this.es.readyState !== EventSource.CLOSED && Date.now() - this.lastHeard < 45_000) return
    this.restart()
  }

  /** v4 #13: words this tab typed in the last minute that a REMOTE change just removed (a restore, an accept). */
  private onAfterTransaction = (tr: Y.Transaction) => {
    if (tr.origin !== this || this.destroyed) return
    const words = wordsRemoved(tr, this.doc.clientID, this.typing.since(60_000))
    if (words) this.hooks.onWordsRemoved(words)
  }

  // ------------------------------------------------------------------ outgoing

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || origin === this.local || origin === FROM_OUTBOX) return // the server's, or stored copies loading
    if (this.frozen) return
    this.typing.note()
    if (!this.info || this.canWrite) this.addToOutbox(update)
  }

  private addToOutbox(update: Uint8Array) {
    this.outbox.push(update)
    this.persistOutbox()
    if (this.es && this.canWrite) this.setState("saving")
    this.flush()
  }

  private persistOutbox() {
    const ls = storage()
    if (!ls) return
    try {
      if (this.outbox.length) ls.setItem(this.outboxKey, b64(Y.mergeUpdates(this.outbox)))
      else ls.removeItem(this.outboxKey)
    } catch {
      // storage full: the outbox still lives in memory (and the device copy in IndexedDB)
    }
  }

  private async refuse(why: string) {
    this.frozen = true // nothing more from this tab, from this instant
    this.emit()
    this.outbox = []
    this.persistOutbox()
    await this.local?.clearData().catch(() => undefined)
    this.hooks.onRefused(why)
  }

  private flush = async (keepalive = false) => {
    if (this.inFlight || this.frozen || !this.outbox.length || !this.es || !this.sub || !this.canWrite || this.destroyed) return
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    const count = this.outbox.length
    const update = count === 1 ? this.outbox[0] : Y.mergeUpdates(this.outbox)
    this.inFlight = count
    let res: Response | null = null
    try {
      res = await fetch(`/api/scripts/${this.scriptId}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: this.doc.clientID, update: b64(update), sub: this.sub }),
        keepalive: keepalive && update.length < 48_000,
      })
    } catch {
      res = null // offline: back off below
    }
    this.inFlight = 0
    if (res?.ok) {
      this.outbox.splice(0, count)
      this.persistOutbox()
      this.postRetry = 0
      if (this.outbox.length) this.flush()
      else this.setState("saved")
      return
    }
    if (res && (res.status === 409 || res.status === 400 || res.status === 413)) {
      const body = await res.json().catch(() => ({}) as Record<string, unknown>)
      const why = res.status === 409 ? String(body.why ?? "the server couldn't accept that change") : "that change was too large or couldn't be read"
      return this.refuse(why)
    }
    if (res && (res.status === 401 || res.status === 403 || res.status === 404)) {
      const body = await res.json().catch(() => ({}) as Record<string, unknown>)
      this.ended = String(body.error ?? "You can't change this script any more.")
      this.emit()
      return
    }
    // offline or a server error: keep every word, try again with a growing wait (the stream's own health is the
    // watchdog's business)
    this.setState("offline")
    const wait = Math.min(30_000, 1000 * 2 ** Math.min(this.postRetry++, 5))
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, wait)
  }

  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.flush(true)
    else this.reconnectNow()
  }

  // ------------------------------------------------------------------ presence

  private onAwarenessUpdate = (_changes: unknown, origin: unknown) => {
    if (origin !== "local") return
    if (this.awarenessTimer) return
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = null
      this.sendAwareness()
    }, 250)
  }

  private sendAwareness() {
    if (!this.es || !this.sub || this.destroyed || !this.awareness.getLocalState()) return
    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
    fetch(`/api/scripts/${this.scriptId}/awareness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update: b64(update), sub: this.sub }),
    }).catch(() => undefined)
  }

  /** Who else is here (by name, from the server-stamped awareness states). */
  others(): { client: number; name: string; color: string }[] {
    const out: { client: number; name: string; color: string }[] = []
    this.awareness.getStates().forEach((s, client) => {
      const u = (s as { user?: { name?: string; color?: string; code?: string } }).user
      if (client !== this.doc.clientID && u?.name && u.code !== this.info?.me.code) out.push({ client, name: u.name, color: u.color ?? "#888" })
    })
    return out
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.es?.close()
    this.es = null
    this.clearReconnect()
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.presenceTimer) clearInterval(this.presenceTimer)
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
    if (this.watchdog) clearInterval(this.watchdog)
    window.removeEventListener("online", this.reconnectNow)
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.doc.off("afterTransaction", this.onAfterTransaction)
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local")
    this.local?.destroy().catch(() => undefined)
    this.emit()
  }
}
