import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IS_STAGING } from "@/lib/site-env"
import { GATE_ENTER, GATE_CODE, GATE_SIGNOUT, safeNext } from "@/lib/staging/gate"
import { GateShell } from "./ui"
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Staging · Oliver Street Creative", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default function StagingGate({ searchParams }: { searchParams: { next?: string | string[]; sent?: string; invalid?: string; wrong?: string; code?: string } }) {
  if (!IS_STAGING) notFound()
  const next = safeNext(typeof searchParams.next === "string" ? searchParams.next : "/")
  const code = searchParams.code === "1" || searchParams.sent === "1"
  const demoEnded = /^\/login\?(?:.*&)?demo_ended=1(?:&|$)/.test(next)
  return <GateShell>
    <h1 className="sg-h1">Staging</h1>
    <p className="sg-sub">Work in progress. Use your Oliver Street Creative email to look around.</p>
    {demoEnded ? <p className="sg-note" role="status">This demo has ended. Ask Oliver Street Creative for a new link.</p> : null}
    {searchParams.sent === "1" ? <p className="sg-note" role="status">Check your email for a sign-in link and code. They expire in 15 minutes.</p> : null}
    {searchParams.invalid === "1" ? <p className="sg-wrong" role="alert">Use an @oliverstreetcreative.com email address.</p> : null}
    {searchParams.wrong === "1" ? <p className="sg-wrong" role="alert">That link or code couldn't sign you in. Ask for a new link.</p> : null}
    <form method="post" action={GATE_ENTER} className="sg-card">
      <label className="sg-label">Email<input className="sg-input" name="email" type="email" autoComplete="email" required maxLength={254} autoFocus={!code} /></label>
      <input type="hidden" name="next" value={next} />
      <button className="sg-btn" type="submit">Email me a sign-in link</button>
    </form>
    {code ? <form method="post" action={GATE_CODE} className="sg-card">
      <p className="sg-sub">On another phone or computer? Use the code from your email.</p>
      <label className="sg-label">Email<input className="sg-input" name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label className="sg-label">Code<input className="sg-input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required /></label>
      <button className="sg-btn" type="submit">Sign in with the code</button>
    </form> : <a className="sg-sub" href="/staging-gate?code=1">I have a code</a>}
    <form method="post" action={GATE_SIGNOUT}><button className="sg-btn" type="submit">Sign out of staging</button></form>
  </GateShell>
}
