import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { addFile } from "@/lib/client/request-drafts"
import { MAX_FILE_BYTES } from "@/lib/client/request-form"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ONE brand-asset file (SPEC §31 v2), from the draft's assets screen (back=form) or a sent request's "later" page
// (back=request). Middleware already refused a body over 26 MB, or one without a length, before this runs.
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const base = publicOrigin(req)
  const declared = Number(req.headers.get("content-length") ?? "NaN")
  if (!Number.isFinite(declared) || declared > MAX_FILE_BYTES + 1024 * 1024) return new NextResponse("Too large", { status: 413 })
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
