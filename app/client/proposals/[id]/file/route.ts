// GET /client/proposals/<document id>/file: the proposal PDF, ONLY from the gate's frozen copy, hashed as it's read
// (SPEC §24 v2). A mismatch or a missing copy is "not available", never another file. Every serve to a client is
// logged (who, which bytes), so the record can show the file was opened. A hidden proposal still serves to the org
// that accepted it (receipts outlive the listing).
import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { findProposal, frozenPdf } from "@/lib/client/proposals"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  let found = await findProposal(ctx, params.id)
  if (!found) {
    const hidden = await findProposal(ctx, params.id, { evenHidden: true })
    found = hidden?.doc.acceptance ? hidden : null
  }
  if (!found) return new NextResponse(null, { status: 404 })
  const { doc } = found
  const sha = doc.acceptance?.sha256 ?? doc.sha256
  const bytes = await frozenPdf(sha)
  if (!bytes || !sha) return new NextResponse("The proposal file isn't available right now.", { status: 404 })
  if (!ctx.viewing) {
    await db.proposalView.create({ data: { document_id: doc.id, person_id: ctx.user.id, sha256: sha } }).catch((err) => console.error("proposals: view log failed", err))
  }
  const name = `${doc.title.replace(/[^\w .()-]+/g, " ").trim().slice(0, 80) || "Proposal"}.pdf`
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
