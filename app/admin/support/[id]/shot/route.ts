// GET /admin/support/<id>/shot: a report's screenshot, for STAFF only (SPEC §29 v2). The database decides who is staff
// (getStaffUser), not the session token. Never cached; served as an image only.
import { NextResponse } from "next/server"
import { getStaffUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { supportEnv } from "@/lib/support/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } })

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getStaffUser())) return notFound()
  if (!UUID.test(params.id)) return notFound()
  const shot = await db.supportAttachment.findFirst({
    where: { ticket_id: params.id.toLowerCase(), mime: "image/jpeg", ticket: { env: supportEnv() } },
    select: { bytes: true },
  })
  if (!shot) return notFound()
  return new NextResponse(Buffer.from(shot.bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  })
}
