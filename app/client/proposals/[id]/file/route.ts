// GET /client/proposals/<document id>/file: the proposal PDF, ONLY from the gate's frozen copy, hashed as it's read
// (SPEC §24 v2). A mismatch or a missing copy is "not available", never another file. Every serve to a client is
// logged (who, which bytes), so the record can show the file was opened. A hidden proposal still serves to the org
// that accepted it (receipts outlive the listing). The staging demo's SAMPLE proposal (repo-sourced, never gated, no
// frozen copy) is the one exception: it streams from its sample path, and it can't be accepted (the demo is read-only).
import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { findProposal, frozenPdf } from "@/lib/client/proposals"
import { isDemoSlug } from "@/lib/client/demo"
import { streamFile } from "@/lib/client/serve"
import { db } from "@/lib/db"
import { isPreviewSession } from "@/lib/auth/require-session"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
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
  if (!sha) {
    const org = ctx.orgs.find((o) => o.id === doc.organization_id)
    if (isDemoSlug(org?.slug) && doc.dropbox_path) return streamFile(doc.dropbox_path, { inline: true })
    return new NextResponse("The proposal file isn't available right now.", { status: 404 })
  }
  const bytes = await frozenPdf(sha)
  if (!bytes) return new NextResponse("The proposal file isn't available right now.", { status: 404 })
  // Log a CLIENT opening it: never staff viewing, never a staging preview sign-in.
  if (!ctx.viewing && !(await isPreviewSession())) {
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
