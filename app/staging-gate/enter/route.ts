// Staging's password form posts here (client-website SPEC §32 v2). Right password → the pass (30 days) and the
// Comment button's cookie, then on to `next` on this site. Wrong → back to the gate with plain words. 404 off staging.
// No rate limiter on purpose: the password is 24 random characters, and a counter in memory would reset on every deploy
// and could lock Sam's phone out behind a driver holding a stale password.
import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "crypto"
import { IS_STAGING } from "@/lib/site-env"
import { isSecure, publicOrigin } from "@/lib/client/host"
import { GATE_PAGE, GATE_UI_COOKIE, PASS_SECONDS, gatePassword, makePass, nowSeconds, passCookie, safeNext } from "@/lib/staging/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest()

export async function POST(req: NextRequest) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  const password = gatePassword()
  if (!password) return new NextResponse("Staging is closed.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })
  let given = ""
  let next = "/"
  try {
    const form = await req.formData()
    given = String(form.get("password") ?? "").trim().slice(0, 200)
    next = safeNext(String(form.get("next") ?? "/"))
  } catch {
    /* not a form: a wrong password */
  }
  const base = publicOrigin(req)
  // Constant time: both sides hashed to the same length first.
  if (!given || !timingSafeEqual(digest(given), digest(password))) {
    return NextResponse.redirect(`${base}${GATE_PAGE}?next=${encodeURIComponent(next)}&wrong=1`, 303)
  }
  const secure = isSecure(req)
  const res = NextResponse.redirect(`${base}${next}`, 303)
  const pass = passCookie(secure, PASS_SECONDS)
  res.cookies.set(pass.name, await makePass(password, nowSeconds() + PASS_SECONDS), pass.options)
  // Readable by the page: it only shows the Comment button (the comment API sits behind the pass itself).
  res.cookies.set(GATE_UI_COOKIE, "1", { path: "/", httpOnly: false, secure, sameSite: "lax", maxAge: PASS_SECONDS })
  res.headers.set("cache-control", "no-store")
  return res
}
