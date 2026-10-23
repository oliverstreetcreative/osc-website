import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { streamFile } from "@/lib/client/serve"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { kind: string; id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const orgIds = ctx.orgs.map((o) => o.id)
  let path: string | null | undefined = null
  if (params.kind === "project") {
    path = (await db.project.findFirst({ where: { id: params.id, hidden: false, organization_id: { in: orgIds } } }))?.poster_path
  } else if (params.kind === "film") {
    path = (await db.deliverable.findFirst({ where: { id: params.id, hidden: false, project: { organization_id: { in: orgIds } } } }))?.poster_path
  }
  if (!path) return new NextResponse(null, { status: 404 })
  if (path.startsWith("/client-logos/") || path.startsWith("/images/")) return NextResponse.redirect(new URL(path, req.url))
  return streamFile(path, { inline: true })
}
