import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { redirectToFile } from "@/lib/client/serve"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string; n: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const f = await db.deliverable.findFirst({
    where: { id: params.id, hidden: false, project: { hidden: false, organization_id: { in: ctx.orgs.map((o) => o.id) } } },
  })
  const dl = (Array.isArray(f?.downloads) ? f!.downloads : [])[Number(params.n)] as { path?: string; url?: string } | undefined
  if (!dl) return new NextResponse(null, { status: 404 })
  if (dl.url && !dl.path) return NextResponse.redirect(dl.url, 302)
  return redirectToFile(dl.path!, req)
}
