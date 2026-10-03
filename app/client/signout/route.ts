import { NextRequest, NextResponse } from "next/server"
import { clearCookies, publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(`${publicOrigin(req)}/login?signed_out=1`, 303)
  // Host-only cookies AND any old domain-wide ones from before 10/3.
  clearCookies(res, req, ["osc_session", "osc_impersonating", "cs_view"])
  return res
}
