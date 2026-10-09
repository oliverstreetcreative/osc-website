// osc-app's own health check (client-website SPEC §33 v2, design review #7): Railway's healthcheck path. `/healthz` is
// Forms' (proxied), so it can't say whether THIS app is up. 200 = the server booted (a bad config or a schema that
// didn't apply stops the boot) and the database answers. It says nothing else but the short commit, so a check can tell
// which build is live.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7) || null
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, version }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, version }, { status: 503, headers: { "cache-control": "no-store" } })
  }
}
