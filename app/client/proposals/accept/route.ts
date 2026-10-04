// POST /client/proposals/accept (form: document_id, sha256): the client's yes to exactly this proposal file (SPEC §24
// v2). Success → the receipt; a refusal → back to the proposal with a CODE (its words live on the page).
import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { acceptProposal } from "@/lib/client/proposals"
import { clientIp } from "@/lib/client/approvals"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req)
  const ctx = await getClientContext()
  if (!ctx) return NextResponse.redirect(`${origin}/login`, 303)
  const form = await req.formData().catch(() => null)
  const id = String(form?.get("document_id") ?? "")
  const sha = String(form?.get("sha256") ?? "")
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${origin}/client/documents`, 303)
  const r = await acceptProposal(ctx, id, sha, {
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    preview: req.headers.get("x-user-preview") === "true",
  })
  if (!r.ok) return NextResponse.redirect(`${origin}/client/proposals/${id}?why=${r.code}`, 303)
  return NextResponse.redirect(`${origin}/client/acceptances/${r.id}`, 303)
}
