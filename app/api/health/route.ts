// osc-app's own health check (client-website SPEC §33 v2, design review #7): Railway's healthcheck path. `/healthz` is
// Forms' (proxied), so it can't say whether THIS app is up. 200 = the server booted (a bad config or a schema that
// didn't apply stops the boot), the database answers, and the client site's tables are there (built review #5: a
// fresh database without its schema would otherwise look healthy). It says nothing else but the short commit, so a
// check can tell which build is live.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7) || null
  const headers = { "cache-control": "no-store" }
  try {
    const rows = await db.$queryRaw<{ t: string | null }[]>`SELECT to_regclass('public.people')::text AS t`
    if (!rows[0]?.t) return NextResponse.json({ ok: false, version, why: "schema" }, { status: 503, headers })
    return NextResponse.json({ ok: true, version }, { headers })
  } catch {
    return NextResponse.json({ ok: false, version, why: "database" }, { status: 503, headers })
  }
}
