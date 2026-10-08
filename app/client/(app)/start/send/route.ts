import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { sendDraft } from "@/lib/client/request-drafts"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

// Send her draft to Sam (SPEC §31 v2). Every screen must be complete: if one isn't, she's taken to it with its
// problems shown (nothing she typed is lost). A double tap answers with the same request. Then Home, where the request
// now shows as a project in Quote.
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const base = publicOrigin(req)
  const form = await req.formData()
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${base}/client/start`, 303)
  const r = await sendDraft(ctx, id)
  if (r.ok) return NextResponse.redirect(`${base}/client?sent=1`, 303)
  if (r.why === "missing") return NextResponse.redirect(`${base}/client/start/${id}/${r.step}?check=1`, 303)
  if (r.why === "limit") return NextResponse.redirect(`${base}/client/start/${id}/review?error=limit`, 303)
  return NextResponse.redirect(`${base}/client/start`, 303)
}
