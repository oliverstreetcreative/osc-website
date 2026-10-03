// The live scripts (SPEC §14 "Spike A"): one Yjs document per open script, in this process, with its subscribers.
// Server only.
//
// No lost words (v4 #1): the database assigns each update's seq; an update is COMMITTED before it is applied here or
// acknowledged, and the in-memory document only ever holds committed rows, so it is exactly "snapshot + rows <= upto".
// Inserts take a per-script advisory lock for their transaction, so a script's rows commit in seq order even when two
// containers overlap during a deploy; while anyone is subscribed, each container polls once a second for rows the
// other one wrote. Every row is kept; snapshots are a cache.
import * as Y from "yjs"
import * as decoding from "lib0/decoding"
import * as encoding from "lib0/encoding"
import { db } from "@/lib/db"

export const b64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64")
export const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"))

export type Sub = { id: string; personId: string; send: (event: string, data: unknown) => void; close: () => void }
type Presence = { update: Uint8Array; at: number; personId: string }

export type Live = {
  id: string
  doc: Y.Doc
  upto: bigint
  subs: Map<string, Sub>
  presence: Map<number, Presence> // Yjs clientID → its latest awareness update (so a newcomer sees who's here)
  lock: Promise<unknown>
  poll: ReturnType<typeof setInterval> | null
  evict: ReturnType<typeof setTimeout> | null
  sinceSnapshot: number
}

const g = globalThis as unknown as { __oscScripts?: Map<string, Promise<Live>> }
const registry: Map<string, Promise<Live>> = (g.__oscScripts ??= new Map())

const SNAPSHOT_EVERY = 100
const EVICT_AFTER_MS = 10 * 60 * 1000
const PRESENCE_TTL_MS = 30 * 1000

async function load(id: string): Promise<Live> {
  const doc = new Y.Doc({ gc: true })
  let upto = BigInt(0)
  const snap = await db.scriptSnapshot.findFirst({ where: { script_id: id }, orderBy: { upto_id: "desc" } })
  if (snap) {
    Y.applyUpdate(doc, new Uint8Array(snap.state))
    upto = snap.upto_id
  }
  const rows = await db.scriptUpdate.findMany({ where: { script_id: id, id: { gt: upto } }, orderBy: { id: "asc" } })
  for (const r of rows) {
    Y.applyUpdate(doc, new Uint8Array(r.update))
    upto = r.id
  }
  return { id, doc, upto, subs: new Map(), presence: new Map(), lock: Promise.resolve(), poll: null, evict: null, sinceSnapshot: rows.length }
}

export function openLive(id: string): Promise<Live> {
  let p = registry.get(id)
  if (!p) {
    p = load(id)
    registry.set(id, p)
    p.catch(() => registry.delete(id))
  }
  return p
}

/** Run `fn` with the script's live document, one call at a time per script. */
export async function withLive<T>(id: string, fn: (l: Live) => Promise<T>): Promise<T> {
  const l = await openLive(id)
  const run = l.lock.then(() => fn(l))
  l.lock = run.catch(() => undefined)
  return run
}

export function broadcast(l: Live, event: string, data: unknown, exceptSub?: string) {
  for (const s of l.subs.values()) if (s.id !== exceptSub) s.send(event, data)
}

/** Apply rows committed since we last looked (another container's, or our own just now), in seq order. Call inside
 *  withLive. `own` = the sub that sent the row with that seq (it already has it). */
export async function catchUp(l: Live, own?: { seq: bigint; sub?: string }) {
  const rows = await db.scriptUpdate.findMany({ where: { script_id: l.id, id: { gt: l.upto } }, orderBy: { id: "asc" } })
  for (const r of rows) {
    const update = new Uint8Array(r.update)
    Y.applyUpdate(l.doc, update, "db")
    l.upto = r.id
    l.sinceSnapshot++
    broadcast(l, "update", { seq: String(r.id), update: b64(update) }, own && own.seq === r.id ? own.sub : undefined)
  }
  return rows.length
}

/** Commit one update (already checked), then apply it here and pass it on. Call inside withLive. Returns its seq. */
export async function commit(l: Live, update: Uint8Array, personId: string, clientId: number, sub?: string): Promise<bigint> {
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${l.id}))`
    return tx.scriptUpdate.create({
      data: { script_id: l.id, update: Buffer.from(update), person_id: personId, client_id: BigInt(clientId) },
      select: { id: true },
    })
  })
  await catchUp(l, { seq: row.id, sub })
  if (l.sinceSnapshot >= SNAPSHOT_EVERY) await snapshot(l)
  return row.id
}

/** A cache of the state up to `upto` (the memory document holds exactly the committed rows up to there). */
export async function snapshot(l: Live) {
  if (!l.sinceSnapshot) return
  await db.scriptSnapshot.create({ data: { script_id: l.id, upto_id: l.upto, state: Buffer.from(Y.encodeStateAsUpdate(l.doc)) } })
  l.sinceSnapshot = 0
}

/** A subscriber joins: stop any eviction, poll for other containers' rows while anyone is here. */
export function subscribe(l: Live, sub: Sub) {
  l.subs.set(sub.id, sub)
  if (l.evict) {
    clearTimeout(l.evict)
    l.evict = null
  }
  if (!l.poll) {
    l.poll = setInterval(() => {
      withLive(l.id, (x) => catchUp(x)).catch(() => undefined)
    }, 1000)
  }
}

export function unsubscribe(l: Live, subId: string) {
  if (!l.subs.delete(subId)) return
  for (const [client, p] of l.presence) {
    if (![...l.subs.values()].some((s) => s.personId === p.personId)) {
      l.presence.delete(client)
      broadcast(l, "left", { client })
    }
  }
  if (l.subs.size) return
  if (l.poll) {
    clearInterval(l.poll)
    l.poll = null
  }
  l.evict = setTimeout(() => {
    withLive(l.id, async (x) => {
      if (x.subs.size) return
      await snapshot(x).catch(() => undefined)
      registry.delete(x.id)
    }).catch(() => undefined)
  }, EVICT_AFTER_MS)
}

/** Everyone currently here (their latest awareness updates), for a newcomer. */
export function presenceNow(l: Live): string[] {
  const now = Date.now()
  const out: string[] = []
  for (const [client, p] of l.presence) {
    if (now - p.at > PRESENCE_TTL_MS) l.presence.delete(client)
    else out.push(b64(p.update))
  }
  return out
}

export type AwarenessEntry = { client: number; clock: number; state: Record<string, unknown> | null }

/** y-protocols' awareness update format: varuint count, then per client: clientID, clock, JSON state. */
export function decodeAwareness(update: Uint8Array): AwarenessEntry[] | null {
  try {
    const d = decoding.createDecoder(update)
    const n = decoding.readVarUint(d)
    if (n > 16) return null
    const out: AwarenessEntry[] = []
    for (let i = 0; i < n; i++) {
      const client = decoding.readVarUint(d)
      const clock = decoding.readVarUint(d)
      const state = JSON.parse(decoding.readVarString(d))
      out.push({ client, clock, state: state && typeof state === "object" ? state : null })
    }
    return out
  } catch {
    return null
  }
}

export function encodeAwareness(entries: AwarenessEntry[]): Uint8Array {
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, entries.length)
  for (const x of entries) {
    encoding.writeVarUint(e, x.client)
    encoding.writeVarUint(e, x.clock)
    encoding.writeVarString(e, JSON.stringify(x.state))
  }
  return encoding.toUint8Array(e)
}

export function rememberPresence(l: Live, client: number, update: Uint8Array, personId: string, gone: boolean) {
  if (gone) l.presence.delete(client)
  else l.presence.set(client, { update, at: Date.now(), personId })
}
