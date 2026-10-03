// The browser's half of the live transport (SPEC §14 Spike A; v4 #1 "no lost words"). Browser only.
//
// Listens on /api/scripts/<id>/events (Server-Sent Events) and POSTs local changes to /updates. A local change stays
// in an OUTBOX (kept in this browser's storage too) until the server answers with its seq; on every reconnect the
// outbox goes again, plus anything the server's state vector says it lacks (what this phone typed offline in an
// earlier visit, kept by y-indexeddb). The page flushes when it's hidden. Status for the editor: Saved / Saving… /
// Offline, saved on this phone. A refusal (409: a suggestion the server can't accept) hands the person's words back
// and starts again from the server's copy.
import * as Y from "yjs"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"
import { IndexeddbPersistence } from "y-indexeddb"

export type SaveState = "connecting" | "saved" | "saving" | "offline" | "read-only"
export type SyncInfo = { role: "viewer" | "commenter" | "suggester" | "editor"; readOnly: string | null; me: { code: string; name: string } }

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

export class ScriptSync {
  readonly doc = new Y.Doc()
  readonly awareness: Awareness
  state: SaveState = "connecting"
  info: SyncInfo | null = null
  /** The server stopped us: access ended, or the script is gone. */
  ended: string | null = null
  /** Bumps whenever the server says comments changed (the comments panel re-reads with its own filter). */
  commentsVersion = 0

  private es: EventSource | null = null
  private sub: string | null = null
  private outbox: Uint8Array[] = []
  private inFlight = 0 // outbox items the current POST carries
  private retry = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private presenceTimer: ReturnType<typeof setInterval> | null = null
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null
  private local: IndexeddbPersistence | null = null
  private listeners = new Set<() => void>()
  private destroyed = false
  private readonly outboxKey: string
  private lastHeard = 0 // when the stream last said anything (the server pings every 20 s)
  private watchdog: ReturnType<typeof setInterval> | null = null

  constructor(
    readonly scriptId: string,
    private readonly hooks: { onRefused: (why: string) => void },
  ) {
    this.awareness = new Awareness(this.doc)
    this.outboxKey = `osc-script-outbox-${scriptId}`
    try {
      const saved = localStorage.getItem(this.outboxKey)
      if (saved) this.outbox = [fromB64(saved)]
    } catch {
      // private mode: the outbox lives in memory only
    }
    this.doc.on("update", this.onDocUpdate)
    this.awareness.on("update", this.onAwarenessUpdate)
    try {
      this.local = new IndexeddbPersistence(`osc-script-${scriptId}`, this.doc)
      this.local.whenSynced.then(() => this.connect()).catch(() => this.connect())
    } catch {
      this.connect()
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

  private restart() {
    this.es?.close()
    this.es = null
    this.sub = null
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.retry = 0
    this.connect()
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
  private get canWrite() {
    return !!this.info && !this.info.readOnly && (this.info.role === "suggester" || this.info.role === "editor")
  }

  // ------------------------------------------------------------------ incoming

  private connect = () => {
    if (this.destroyed) return
    this.es?.close()
    const sv = b64(Y.encodeStateVector(this.doc))
    const es = new EventSource(`/api/scripts/${this.scriptId}/events?sv=${encodeURIComponent(sv)}`)
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
        // what this phone has that the server lacks (an earlier visit's offline typing)
        const missing = Y.encodeStateAsUpdate(this.doc, fromB64(d.sv))
        if (hasStructs(missing)) this.addToOutbox(missing)
      } else this.outbox = []
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
      this.reconnectTimer = setTimeout(this.connect, wait)
    }
  }

  private reconnectNow = () => {
    if (this.destroyed) return
    // a stream that's open and has spoken in the last 45 s is fine; anything else starts over
    if (this.es && this.es.readyState !== EventSource.CLOSED && Date.now() - this.lastHeard < 45_000) return
    this.restart()
  }

  // ------------------------------------------------------------------ outgoing

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || origin === this.local) return // the server's, or this phone's stored copy loading
    if (!this.info || this.canWrite) this.addToOutbox(update)
  }

  private addToOutbox(update: Uint8Array) {
    this.outbox.push(update)
    this.persistOutbox()
    if (this.es && this.canWrite) this.setState("saving")
    this.flush()
  }

  private persistOutbox() {
    try {
      if (this.outbox.length) localStorage.setItem(this.outboxKey, b64(Y.mergeUpdates(this.outbox)))
      else localStorage.removeItem(this.outboxKey)
    } catch {
      // storage full or private mode: the outbox still lives in memory
    }
  }

  private flush = async (keepalive = false) => {
    if (this.inFlight || !this.outbox.length || !this.es || !this.sub || !this.canWrite || this.destroyed) return
    const count = this.outbox.length
    const update = count === 1 ? this.outbox[0] : Y.mergeUpdates(this.outbox)
    this.inFlight = count
    try {
      const res = await fetch(`/api/scripts/${this.scriptId}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: this.doc.clientID, update: b64(update), sub: this.sub }),
        keepalive: keepalive && update.length < 48_000,
      })
      if (res.ok) {
        this.outbox.splice(0, count)
        this.persistOutbox()
      } else if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        this.outbox = []
        this.persistOutbox()
        await this.local?.clearData().catch(() => undefined)
        this.hooks.onRefused(String(body.why ?? "the server couldn't accept that change"))
        return
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        const body = await res.json().catch(() => ({}))
        this.ended = String(body.error ?? "You can't change this script any more.")
        this.emit()
        return
      } else throw new Error(String(res.status))
    } catch {
      this.inFlight = 0
      this.setState("offline")
      this.es?.close()
      this.es = null
      this.reconnectTimer = setTimeout(this.connect, 2000)
      return
    }
    this.inFlight = 0
    if (this.outbox.length) this.flush()
    else this.setState("saved")
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.presenceTimer) clearInterval(this.presenceTimer)
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
    if (this.watchdog) clearInterval(this.watchdog)
    window.removeEventListener("online", this.reconnectNow)
    document.removeEventListener("visibilitychange", this.onVisibility)
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local")
    this.local?.destroy().catch(() => undefined)
    this.emit()
  }
}
