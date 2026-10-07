// POST /id/deputies/grant (form: email, scope, until, reason): the owner makes someone a deputy for Sign Here
// (SPEC §27 P1 v2 #8). Owner + a 10-minute step-up; middleware already checks the origin for any write with a session.
import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/generated/prisma"
import { db } from "@/lib/db"
import { publicOrigin } from "@/lib/client/host"
import { cleanGrant } from "@/lib/idp/rules"
import { ownerStepUp } from "@/lib/idp/owner"
import { tellOwner } from "@/lib/idp/notify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${publicOrigin(req)}/id/deputies${q}`, 303)
  const gate = await ownerStepUp()
  if (!gate.ok) return gate.why === "stale" ? back("") : new NextResponse(null, { status: 404 })
  const form = await req.formData().catch(() => null)
  const r = cleanGrant(
    { email: form?.get("email"), scope: form?.get("scope"), until: form?.get("until"), reason: form?.get("reason") },
    gate.owner,
    new Date(),
  )
  if (!r.ok) return back(`?error=${r.code}`)
  const g = r.grant
  const row = await db.deputyGrant.create({
    data: { email: g.email, surfaces: ["sign"], scope: g.scope as Prisma.InputJsonValue, until: g.until, reason: g.reason, granted_by: gate.owner },
  })
  await db.idpAudit.create({
    data: { action: "grant", actor: gate.owner, subject: g.email, detail: { id: row.id, surfaces: ["sign"], scope: g.scope, until: g.until.toISOString(), reason: g.reason } },
  })
  const until = g.until.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
  void tellOwner("deputy_grant", `New deputy: ${g.email}`, [
    `${g.email} can now send and manage agreements in Sign Here for you, ${g.scope === "all" ? "on all jobs" : `on jobs ${g.scope.join(", ")}`}, until ${until}.`,
  ]).catch((err) => console.error("deputies: notice failed", err))
  return back("?done=granted")
}
