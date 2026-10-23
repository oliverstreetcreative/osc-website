import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { removeFile } from "@/lib/client/request-drafts"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

// Remove one file from her DRAFT's list (SPEC §31 v2). It stays in Dropbox and still counts toward the 20.
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const base = publicOrigin(req)
  const form = await req.formData()
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : ""
  const n = Number(form.get("n"))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n) || n < 1) return NextResponse.redirect(`${base}/client/start`, 303)
  await removeFile(ctx, id, n)
  return NextResponse.redirect(`${base}/client/start/${id}/assets`, 303)
}
