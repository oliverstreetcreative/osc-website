import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { addFile } from "@/lib/client/request-drafts"
import { MAX_FILE_BYTES } from "@/lib/client/request-form"
import { publicOrigin } from "@/lib/client/host"
import { sameOrigin } from "@/lib/support/http"
import { isPreviewSession } from "@/lib/auth/require-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ONE brand-asset file (SPEC §31 v2), from the draft's assets screen (back=form) or a sent request's "later" page
// (back=request). This path skips middleware (it would buffer the whole body first), so the checks middleware gives
// every other write happen HERE, before the body is read: the size it declares, the same origin, a real session that
// may write (never staff viewing, the demo, or a preview sign-in).
export async function POST(req: Request) {
  const base = publicOrigin(req)
  const declared = Number(req.headers.get("content-length") ?? "NaN")
  if (!Number.isFinite(declared) || declared > MAX_FILE_BYTES + 1024 * 1024) {
    // From an upload screen of this site: back to it with plain words. Otherwise a bare 413.
    try {
      const from = new URL(req.headers.get("referer") ?? "")
      if (from.origin === base && /^\/client\/(start|requests)\/[0-9a-f-]{36}\/assets$/i.test(from.pathname)) {
        return NextResponse.redirect(`${base}${from.pathname}?up=size`, 303)
      }
    } catch {
      /* no usable referer */
    }
    return new NextResponse("That file is too large to upload here (25 MB at most).", { status: 413, headers: { "content-type": "text/plain; charset=utf-8" } })
  }
  if (!sameOrigin(req)) return new NextResponse("This request came from another site and was refused.", { status: 403 })
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  if (await isPreviewSession()) return new NextResponse("Read-only: this is a preview sign-in.", { status: 403 })
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.redirect(`${base}/client/start`, 303)
  }
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : ""
  const back = form.get("back") === "request" ? "request" : "form"
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${base}/client/start`, 303)
  const there = back === "request" ? `${base}/client/requests/${id}/assets` : `${base}/client/start/${id}/assets`
  const file = form.get("file")
  if (!file || typeof file === "string" || file.size === 0) return NextResponse.redirect(`${there}?up=none`, 303)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await addFile(ctx, id, { name: file.name, type: file.type, bytes })
  return NextResponse.redirect(`${there}?up=${result.ok ? "ok" : result.why}`, 303)
}
