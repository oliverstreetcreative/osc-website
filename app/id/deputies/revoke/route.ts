// POST /id/deputies/revoke (form: id): the owner ends a deputy grant (SPEC §27 P1 v2 #8). Sign Here re-checks the
// grant on every admin action, so it stops working there at once; from P1b a back-channel logout also ends their Sign
// Here session (their client-site sessions stay: review SIMPLIFY 18).
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { publicOrigin } from "@/lib/client/host"
import { ownerStepUp } from "@/lib/idp/owner"
import { tellOwner } from "@/lib/idp/notify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${publicOrigin(req)}/id/deputies${q}`, 303)
  const gate = await ownerStepUp()
  if (!gate.ok) return gate.why === "stale" ? back("") : new NextResponse(null, { status: 404 })
  const form = await req.formData().catch(() => null)
  const id = String(form?.get("id") ?? "")
  if (!UUID.test(id)) return back("")
  const grant = await db.deputyGrant.findUnique({ where: { id } })
  if (!grant || grant.revoked_at) return back("")
  const done = await db.deputyGrant.updateMany({ where: { id, revoked_at: null }, data: { revoked_at: new Date(), revoked_by: gate.owner } })
  if (done.count === 1) {
    await db.idpAudit.create({ data: { action: "revoke", actor: gate.owner, subject: grant.email, detail: { id } } })
    void tellOwner("deputy_revoke", `Deputy revoked: ${grant.email}`, [`${grant.email} can no longer act for you in Sign Here.`]).catch((err) =>
      console.error("deputies: notice failed", err),
    )
  }
  return back("?done=revoked")
}
