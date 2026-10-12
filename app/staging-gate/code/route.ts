import { NextRequest, NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { publicOrigin } from "@/lib/client/host"
import { deviceFrom } from "@/lib/auth/door"
import { sameOrigin } from "@/lib/support/http"
import { GATE_PAGE } from "@/lib/staging/gate"
import { gateForm } from "@/lib/staging/form"
import { verifyCode } from "@/lib/staging/magic"
import { grantGate, magicDeps } from "@/lib/staging/magic-server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 })
  const base = publicOrigin(req)
  const form = await gateForm(req)
  if (!form) return new NextResponse(null, { status: 400 })
  try {
    const result = await verifyCode(form.get("email"), form.get("code"), base, magicDeps(req, deviceFrom(req)))
    if (!result.ok) return NextResponse.redirect(`${base}${GATE_PAGE}?code=1&wrong=1`, 303)
    const res = NextResponse.redirect(`${base}${result.next}`, 303)
    await grantGate(req, res)
    return res
  } catch { return new NextResponse("Staging access is unavailable. Please try again.", { status: 503 }) }
}
