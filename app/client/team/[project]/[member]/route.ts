// Save a team member's contact (SPEC §21 v2): a vCard 3.0 built from the PUBLISHED team card, for a signed-in
// person of the project's own client (or staff viewing as that client). Keyed by a stable member id, never by
// list position, and never cached.
import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { orgProject } from "@/lib/client/data"
import { memberId, teamOf, vcard } from "@/lib/client/team"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { project: string; member: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  for (const o of [ctx.org, ...ctx.orgs.filter((x) => x.id !== ctx.org.id)]) {
    const p = await orgProject(o.id, params.project)
    if (!p) continue
    const m = teamOf(p.team).find((x) => memberId(x) === params.member)
    if (!m) break
    return new NextResponse(vcard(m), {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${memberId(m)}.vcf"`,
        "Cache-Control": "private, no-store",
      },
    })
  }
  return new NextResponse(null, { status: 404 })
}
