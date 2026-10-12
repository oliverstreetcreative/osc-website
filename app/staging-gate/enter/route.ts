import { NextRequest, NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { publicOrigin } from "@/lib/client/host"
import { ensureDevice } from "@/lib/auth/door"
import { sameOrigin } from "@/lib/support/http"
import { GATE_PAGE, gateKey, safeNext } from "@/lib/staging/gate"
import { gateForm } from "@/lib/staging/form"
import { requestLink } from "@/lib/staging/magic"
import { magicDeps } from "@/lib/staging/magic-server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 })
  if (!gateKey()) return new NextResponse("Staging access is unavailable.", { status: 503 })
  const form = await gateForm(req)
  if (!form) return new NextResponse(null, { status: 400 })
  const next = safeNext(form.get("next"))
  const base = publicOrigin(req)
  const res = NextResponse.redirect(`${base}${GATE_PAGE}?sent=1&next=${encodeURIComponent(next)}`, 303)
  const device = ensureDevice(req, res)
  try {
    const result = await requestLink(form.get("email"), next, base, device, magicDeps(req, device))
    if (result === "invalid") return NextResponse.redirect(`${base}${GATE_PAGE}?invalid=1&next=${encodeURIComponent(next)}`, 303)
    if (result === "closed") return new NextResponse("Staging access is unavailable.", { status: 503 })
  } catch {
    return new NextResponse("Couldn't send a link. Please try again.", { status: 503 })
  }
  res.headers.set("cache-control", "no-store")
  return res
}
