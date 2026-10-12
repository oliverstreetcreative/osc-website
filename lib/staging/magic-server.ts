import type { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { IS_STAGING } from "@/lib/site-env"
import { decideLink, decideCodeTry, hashesFor, recordCodeFail, sendSignIn } from "@/lib/auth/door"
import { GATE_UI_COOKIE, PASS_SECONDS, gateKey, makePass, nowSeconds, passCookie } from "./gate"
import { MAX_CODE_TRIES, type MagicDeps } from "./magic"
import { isSecure, publicOrigin } from "@/lib/client/host"

/** Reuse the portal's bounded Postgres counters and email delivery, not its roles. */
export function magicDeps(req: NextRequest, device: string | null): MagicDeps {
  return {
    staging: IS_STAGING, key: gateKey() ?? "", now: Date.now,
    store: {
      create: async (data) => { await db.stagingAccessLink.create({ data }) },
      byToken: (token_hash) => db.stagingAccessLink.findUnique({ where: { token_hash } }),
      byEmail: (email, origin) => db.stagingAccessLink.findFirst({ where: { email, origin }, orderBy: { created_at: "desc" } }),
      consume: async (id, now) => (await db.stagingAccessLink.updateMany({
        where: { id, consumed_at: null, expires_at: { gt: now }, code_tries: { lt: MAX_CODE_TRIES } },
        data: { consumed_at: now },
      })).count === 1,
      failCode: async (id, now) => { await db.stagingAccessLink.updateMany({
        where: { id, consumed_at: null, expires_at: { gt: now }, code_tries: { lt: MAX_CODE_TRIES } },
        data: { code_tries: { increment: 1 } },
      }) },
    },
    allowLink: async (email) => (await decideLink(hashesFor(req, email, device), null, true)).send,
    allowCode: async (email, tries) => (await decideCodeTry(hashesFor(req, email, device), null, tries)).ok,
    recordCodeFailure: async (email) => { await recordCodeFail(hashesFor(req, email, device), false) },
    send: sendSignIn,
  }
}

export async function grantGate(req: NextRequest, res: NextResponse) {
  const key = gateKey()
  if (!key) throw new Error("Staging access is unavailable")
  const pass = passCookie(isSecure(req), PASS_SECONDS, new URL(publicOrigin(req)).hostname)
  res.cookies.set(pass.name, await makePass(key, nowSeconds() + PASS_SECONDS), pass.options)
  res.cookies.set(GATE_UI_COOKIE, "1", { ...pass.options, httpOnly: false })
  res.headers.set("cache-control", "no-store")
  res.headers.set("referrer-policy", "no-referrer")
}
