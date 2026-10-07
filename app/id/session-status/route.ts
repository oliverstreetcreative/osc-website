// POST /id/session-status {sid}: is this sign-in still live, and what may it do on YOUR surface? (client-website SPEC
// §27 P1 v2 #3; contract §4). Server to server: the surface authenticates with its client id and secret (HTTP Basic).
// It answers only for sids issued to the calling client; anything else is simply inactive. No cookies, no session.
// Read-only on purpose: a status call never counts as activity, so a leaked client secret can't keep a sign-in alive.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { IS_PRODUCTION, IS_STAGING } from "@/lib/site-env"
import { readJsonCapped } from "@/lib/support/http"
import { admission } from "@/lib/idp/subjects"
import { INACTIVE, basicClient, statusFor } from "@/lib/idp/status"
import type { IdpEnv } from "@/lib/idp/clients"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const env = (): IdpEnv => (IS_PRODUCTION ? "production" : IS_STAGING ? "staging" : "local")
const NO_STORE = { "Cache-Control": "no-store" }

// A generous per-client limit, per process: a surface checks before admin actions, not in a loop.
const PER_MINUTE = 600
const windows = new Map<string, { start: number; n: number }>()
function rateOk(clientId: string): boolean {
  const now = Date.now()
  const w = windows.get(clientId)
  if (!w || now - w.start > 60_000) {
    windows.set(clientId, { start: now, n: 1 })
    return true
  }
  w.n++
  return w.n <= PER_MINUTE
}

export async function POST(req: NextRequest) {
  const client = basicClient(req.headers.get("authorization"), env(), (n) => process.env[n])
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: { ...NO_STORE, "WWW-Authenticate": 'Basic realm="osc-idp"' } })
  }
  if (!rateOk(client.client_id)) return NextResponse.json({ error: "slow_down" }, { status: 429, headers: NO_STORE })
  const read = await readJsonCapped(req, 2000)
  const sid = read.ok && typeof read.body.sid === "string" && read.body.sid.length <= 200 ? read.body.sid : null
  if (!sid) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE })

  const link = await db.idpSidClient.findUnique({ where: { client_id_sid: { client_id: client.client_id, sid } } })
  if (!link) return NextResponse.json(INACTIVE, { headers: NO_STORE })
  const row = await db.portalSession.findUnique({
    where: { id: link.session_id },
    select: {
      revoked_at: true,
      expires_at: true,
      last_active_at: true,
      token_hash: true,
      scope: true,
      created_at: true,
      kind: true,
      subject: { select: { email: true } },
    },
  })
  const adm = row?.subject ? await admission(row.subject.email) : null
  return NextResponse.json(statusFor({ row, sub: link.sub, admission: adm, surface: client.surface, now: new Date() }), { headers: NO_STORE })
}
