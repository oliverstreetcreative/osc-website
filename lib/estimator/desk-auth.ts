// Who may open the DETAILED quote (the internal "quote desk"). Sam 10/2: it must
// NOT be public. Gate, in order:
//   1. Production: never (until Sam rules otherwise). 404.
//   2. Local `next dev`: open (it's Sam's/Claude's own machine).
//   3. Staging: a staff portal session (its row, lib/auth/require-session.ts),
//      OR the desk key: env QUOTE_DESK_KEY, presented once as ?key=... which
//      sets an httpOnly cookie. No key set = only staff sessions get in.

import { cookies } from "next/headers"
import { sessionUser } from "@/lib/auth/require-session"
import { IS_STAGING } from "@/lib/site-env"

export const DESK_COOKIE = "osc_quote_desk"

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

export function deskKeyOk(k: string | undefined | null): boolean {
  const key = process.env.QUOTE_DESK_KEY
  return Boolean(key && key.length >= 16 && k && timingSafeEqual(k, key))
}

export async function deskAllowed(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true
  if (!IS_STAGING) return false
  const jar = cookies()
  if (deskKeyOk(jar.get(DESK_COOKIE)?.value)) return true
  // A staff session's ROW (SPEC §27 P0 v2): a signed-out or pre-row token no longer opens the desk.
  const s = await sessionUser()
  return !!s && !s.scope && (s.person.is_staff || s.person.role === "STAFF")
}
