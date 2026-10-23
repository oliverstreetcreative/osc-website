import { NextRequest, NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { eventForOrgs, toICS } from "@/lib/client/calendar"
import { publicOrigin } from "@/lib/client/host"
import { seesMoney } from "@/lib/client/money"
import { roleIn } from "@/lib/client/proposals"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx) return new NextResponse(null, { status: 401 })
  const orgIds = ctx.orgs.map((o) => o.id)
  const moneyOrgIds = (await Promise.all(orgIds.map(async (o) => (seesMoney(await roleIn(ctx, o)) ? o : null)))).filter(
    (o): o is string => !!o,
  )
  const e = await eventForOrgs(params.id, orgIds, moneyOrgIds)
  if (!e) return new NextResponse(null, { status: 404 })
  return new NextResponse(toICS([e], publicOrigin(req)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="oliver-street-${e.id.slice(0, 13)}.ics"`,
    },
  })
}
