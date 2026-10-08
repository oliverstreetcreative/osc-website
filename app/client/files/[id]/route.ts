import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { streamFile } from "@/lib/client/serve"
import { roleIn, seesProposals } from "@/lib/client/proposals"
import { MONEY_DOC_KINDS, seesMoney } from "@/lib/client/money"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const doc = await db.document.findFirst({
    where: { id: params.id, hidden: false, organization_id: { in: ctx.orgs.map((o) => o.id) } },
  })
  if (!doc) return new NextResponse(null, { status: 404 })
  // Money documents (invoices, receipts, agreements, proposals) only to someone who sees money in THAT org: the list
  // already hid them, and now the file does too (SPEC §28 v2 review: a VIEWER with the id got the PDF).
  if (MONEY_DOC_KINDS.includes(doc.kind) && !seesMoney(await roleIn(ctx, doc.organization_id))) {
    return new NextResponse(null, { status: 404 })
  }
  // Proposals (SPEC §24 v2): money, so never to a VIEWER, and only ever the gate's FROZEN bytes, never whatever sits
  // at the Dropbox path right now.
  if (doc.kind === "proposal") {
    const role = await roleIn(ctx, doc.organization_id)
    if (!role || !seesProposals(role) || !doc.sha256) return new NextResponse(null, { status: 404 })
    return NextResponse.redirect(new URL(`/client/proposals/${doc.id}/file?v=${doc.sha256.slice(0, 8)}`, req.url), 302)
  }
  if (doc.url) return NextResponse.redirect(doc.url, 302)
  if (!doc.dropbox_path) return new NextResponse(null, { status: 404 })
  return streamFile(doc.dropbox_path, { inline: doc.dropbox_path.toLowerCase().endsWith(".pdf") })
}
