import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { redirectToFile } from "@/lib/client/serve"

export const dynamic = "force-dynamic"

// <video src> for films we hold as browser-playable MP4s.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const f = await db.deliverable.findFirst({
    where: { id: params.id, hidden: false, project: { hidden: false, organization_id: { in: ctx.orgs.map((o) => o.id) } } },
  })
  if (!f?.file_path) return new NextResponse(null, { status: 404 })
  return redirectToFile(f.file_path, req)
}
