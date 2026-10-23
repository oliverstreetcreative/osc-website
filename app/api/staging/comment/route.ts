// Staging's Comment button posts here (client-website SPEC §32 v2). 404 off staging; behind the password gate (in
// middleware) like everything on staging; same origin; a 16 KB body. The note is filed add-only in Dropbox
// (_admin/staging-comments/<day>/<time>_<id>.json) with the facts the SERVER knows (host, build, who's signed in, the
// client being viewed); scripts/route_staging_comments.py takes it to the owning matter's PENDING-RULINGS.md.
// Works in View-as (middleware lets this one write through): a note about a page changes nothing on it.
import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { readJsonCapped, sameOrigin } from "@/lib/support/http"
import { sessionUser } from "@/lib/auth/require-session"
import { getClientContext } from "@/lib/client/context"
import { writeNewFile } from "@/lib/client/dropbox-write"
import { BODY_MAX, commentFile, commentRecord, parseComment, type Who } from "@/lib/staging/comment"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })

export async function POST(req: Request) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  if (!sameOrigin(req)) return json({ error: "This came from another site." }, 403)
  const read = await readJsonCapped(req, BODY_MAX)
  if (!read.ok) return json({ error: read.status === 413 ? "That note is too long." : "Couldn't read that." }, read.status)
  const parsed = parseComment(read.body)
  if (!parsed.ok) return json({ error: parsed.why }, 400)

  // Who's signed in (verified here, never from the browser), and the client a staff member is viewing, if any.
  const session = await sessionUser().catch(() => null)
  const who: Who = session && !session.scope ? { name: session.person.name, email: session.person.email, staff: session.person.is_staff } : null
  let viewingAs: string | null = null
  if (who) {
    const ctx = await getClientContext().catch(() => null)
    viewingAs = ctx ? (ctx.viewing?.orgName ?? ctx.org.short_name ?? ctx.org.name) : null
  }

  const id = randomUUID()
  const at = new Date()
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase()
  const record = commentRecord(parsed.value, {
    id,
    at,
    host,
    ua: req.headers.get("user-agent"),
    build: process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || null,
    who,
    viewingAs,
  })
  const wrote = await writeNewFile(commentFile(at, id), JSON.stringify(record, null, 2) + "\n")
  if (wrote !== "written") {
    console.error("staging comment: not filed", wrote.slice(0, 200))
    return json({ error: "Couldn't save that. Try again in a moment." }, 503)
  }
  return json({ ok: true })
}
