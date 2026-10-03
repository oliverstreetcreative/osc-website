import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { streamFile } from "@/lib/client/serve"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const doc = await db.document.findFirst({
    where: { id: params.id, hidden: false, organization_id: { in: ctx.orgs.map((o) => o.id) } },
  })
  if (!doc) return new NextResponse(null, { status: 404 })
  if (doc.url) return NextResponse.redirect(doc.url, 302)
  if (!doc.dropbox_path) return new NextResponse(null, { status: 404 })
  return streamFile(doc.dropbox_path, { inline: doc.dropbox_path.toLowerCase().endsWith(".pdf") })
}
