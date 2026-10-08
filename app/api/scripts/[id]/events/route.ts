// GET /api/scripts/<id>/events?sv=<base64 state vector>: the script's live feed, as Server-Sent Events (SPEC §14
// Spike A). First `sync` (everything this browser lacks + the server's state vector + who's here), then `update`,
// `awareness` and `left` events as they happen, a ping comment every 20 s. Access is re-checked every minute, so a
// revoked person's stream closes within a minute (§14 edge cases).
import type { NextRequest } from "next/server"
import * as Y from "yjs"
import { roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { sessionStillLive } from "@/lib/auth/require-session"
import { b64, catchUp, fromB64, openLive, presenceNow, subscribe, unsubscribe, withLive } from "@/lib/scripts/server/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const facts = await sessionFacts()
  if (!facts) return new Response("Sign in to open this script.", { status: 401 })
  const access = await roleOf(id, facts)
  if (!access) return new Response("Not found", { status: 404 })
  let sv: Uint8Array | undefined
  const raw = req.nextUrl.searchParams.get("sv")
  if (raw) {
    try {
      sv = fromB64(raw)
      Y.decodeStateVector(sv)
    } catch {
      sv = undefined
    }
  }

  const live = await openLive(id)
  if (req.signal.aborted) return new Response(null, { status: 499 })
  const subId = crypto.randomUUID()
  const enc = new TextEncoder()
  let ping: ReturnType<typeof setInterval> | undefined
  let recheck: ReturnType<typeof setInterval> | undefined
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => {
        if (closed) return
        // nobody reading (the connection went away without telling us): stop, don't queue forever
        if (controller.desiredSize !== null && controller.desiredSize < -200) return close()
        try {
          controller.enqueue(enc.encode(s))
        } catch {
          close()
        }
      }
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      const close = () => {
        if (closed) return
        closed = true
        if (ping) clearInterval(ping)
        if (recheck) clearInterval(recheck)
        unsubscribe(live, subId)
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }
      subscribe(live, { id: subId, personId: facts.person.id, send, close })
      withLive(id, async (l) => {
        await catchUp(l)
        send("sync", {
          sub: subId,
          update: b64(Y.encodeStateAsUpdate(l.doc, sv)),
          sv: b64(Y.encodeStateVector(l.doc)),
          seq: String(l.upto),
          role: access.role,
          read_only: access.readOnly,
          me: { code: facts.person.code, name: facts.person.name },
          presence: presenceNow(l),
        })
      }).catch(() => close())
      // a NAMED ping (not an SSE comment), so the browser can tell a live stream from a silently dead one (iOS Safari
      // after backgrounding) and reconnect
      ping = setInterval(() => send("ping", {}), 20_000)
      recheck = setInterval(() => {
        // The script access AND the session: signing out (or "everywhere") ends an open stream within a minute.
        Promise.all([roleOf(id, facts), sessionStillLive(facts.sid)])
          .then(([a, live]) => {
            if (!a || !live) {
              send("revoked", {})
              close()
            }
          })
          .catch(() => undefined)
      }, 60_000)
      req.signal.addEventListener("abort", close)
      // The browser may have gone while we were still awaiting the session and the database above: an abort listener
      // added to an already-aborted signal never fires, and Next 14 doesn't cancel the body (built review #3).
      if (req.signal.aborted) close()
    },
    cancel() {
      closed = true
      if (ping) clearInterval(ping)
      if (recheck) clearInterval(recheck)
      unsubscribe(live, subId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  })
}
