import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { createRequest } from "@/lib/client/requests"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

// POST from /client/start. Middleware already refused cross-origin and staff-view
// writes; this re-checks, then hands everything to createRequest (strict values).
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const form = await req.formData()
  const str = (k: string) => {
    const v = form.get(k)
    return typeof v === "string" ? v : ""
  }
  const result = await createRequest(ctx, {
    orgSlug: str("org"),
    formKey: str("key"),
    kind: str("kind"),
    timing: str("timing"),
    due: str("due") || undefined,
    about: str("about") || undefined,
  })
  const base = publicOrigin(req)
  if (!result.ok) return NextResponse.redirect(`${base}/client/start?error=${result.reason}`, 303)
  return NextResponse.redirect(`${base}/client/start/sent?id=${result.id}${result.repeat ? "&repeat=1" : ""}`, 303)
}
