// Comments on a script (SPEC §14 v1 scope; v4 #11): Postgres, NEVER in the Yjs doc (everything in the doc syncs to
// everyone in it). Staff comments default Internal (office: staff only); clients see client comments only; replies
// inherit their thread's audience. Commenting never edits the script.
// GET: the threads this person may see. POST {body, anchor?, quote?, thread_id?, suggestion?, audience?}: commenters
// and up. Live: every change sends subscribers a content-free "comments" ping; each browser re-reads with its own
// audience filter, so an internal comment never rides the stream.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { atLeast, roleOf, sessionFacts, UUID } from "@/lib/scripts/server/access"
import { broadcast, openLive } from "@/lib/scripts/server/registry"
import { personCode } from "@/lib/scripts/marks"
import { notify, notifyMentions } from "@/lib/scripts/server/notices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY = 4000
const firstName = (p?: { first_name: string | null; name: string } | null) => (p?.first_name || p?.name || "Someone").trim().split(/\s+/)[0]

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  if (!(await roleOf(params.id, facts))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const rows = await db.scriptComment.findMany({
    where: { script_id: params.id, ...(facts.staff ? {} : { audience: "client" }) },
    orderBy: { created_at: "asc" },
    take: 1000,
  })
  const people = new Map(
    (
      await db.person.findMany({
        where: { id: { in: [...new Set(rows.flatMap((r) => [r.author_id, r.resolved_by].filter((x): x is string => !!x)))] } },
        select: { id: true, name: true, first_name: true },
      })
    ).map((p) => [p.id, firstName(p)]),
  )
  return NextResponse.json({
    comments: rows.map((r) => ({
      id: r.id,
      thread_id: r.thread_id,
      parent_id: r.parent_id,
      author: people.get(r.author_id) ?? "Someone",
      author_code: personCode(r.author_id),
      mine: r.author_id === facts.person.id,
      body: r.body,
      anchor: r.anchor,
      quote: r.quote,
      suggestion: r.suggestion,
      audience: r.audience,
      resolved: !!r.resolved_at,
      resolved_by: r.resolved_by ? people.get(r.resolved_by) ?? "Someone" : null,
      at: r.created_at.toISOString(),
    })),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  const access = await roleOf(params.id, facts)
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (access.readOnly || !atLeast(access.role, "commenter")) return NextResponse.json({ error: access.readOnly ?? "You can read this script, not comment on it." }, { status: 403 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const body = typeof b.body === "string" ? b.body.trim() : ""
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 422 })
  if (body.length > MAX_BODY) return NextResponse.json({ error: "That's too long for a comment." }, { status: 422 })

  let thread_id: string | undefined
  let audience: string
  let parent_id: string | null = null
  if (typeof b.thread_id === "string") {
    if (!UUID.test(b.thread_id)) return NextResponse.json({ error: "Bad request" }, { status: 400 })
    const head = await db.scriptComment.findFirst({ where: { script_id: params.id, thread_id: b.thread_id }, orderBy: { created_at: "asc" } })
    if (!head || (!facts.staff && head.audience !== "client")) return NextResponse.json({ error: "Not found" }, { status: 404 })
    thread_id = head.thread_id
    parent_id = head.id
    audience = head.audience // replies inherit their thread's audience (v4 #11)
  } else {
    audience = facts.staff ? (b.audience === "client" ? "client" : "office") : "client"
  }
  const anchor = isAnchor(b.anchor) ? b.anchor : null
  const quote = typeof b.quote === "string" ? b.quote.slice(0, 500) : null
  const suggestion = typeof b.suggestion === "string" && b.suggestion.length <= 80 ? b.suggestion : null

  const id = crypto.randomUUID()
  await db.scriptComment.create({
    data: {
      id,
      script_id: params.id,
      thread_id: thread_id ?? id,
      parent_id,
      author_id: facts.person.id,
      body,
      anchor: parent_id ? undefined : (anchor ?? undefined),
      quote: parent_id ? null : quote,
      suggestion: parent_id ? null : suggestion,
      audience,
    },
  })
  ping(params.id)
  notify(params.id, "comment", facts.person.id, { internal: audience === "office" }).catch((err) => console.error("scripts: notice failed", err))
  notifyMentions(params.id, body, facts.person.id, audience === "office").catch((err) => console.error("scripts: mention notice failed", err))
  return NextResponse.json({ id, thread_id: thread_id ?? id, audience })
}

function isAnchor(a: unknown): a is { from: string; to: string } {
  if (!a || typeof a !== "object") return false
  const { from, to } = a as { from?: unknown; to?: unknown }
  return typeof from === "string" && typeof to === "string" && from.length < 400 && to.length < 400
}

/** Tell everyone on the script that comments changed (no content: each browser re-reads with its own filter). */
function ping(scriptId: string) {
  openLive(scriptId)
    .then((l) => broadcast(l, "comments", {}))
    .catch(() => undefined)
}
