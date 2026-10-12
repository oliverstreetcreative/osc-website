import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IS_STAGING } from "@/lib/site-env"
import { GATE_VERIFY } from "@/lib/staging/gate"
import { GateShell } from "../ui"
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Open staging · Oliver Street Creative", robots: { index: false, follow: false }, referrer: "no-referrer" }

// No lookup, consumption or cookie on GET: mail scanners do not sign anyone in.
export default function StagingMagic({ searchParams }: { searchParams: { token?: string } }) {
  if (!IS_STAGING) notFound()
  const token = typeof searchParams.token === "string" && /^[0-9a-f]{64}$/.test(searchParams.token) ? searchParams.token : ""
  return <GateShell>
    <h1 className="sg-h1">Open staging.</h1>
    {token ? <form method="post" action={GATE_VERIFY} className="sg-card">
      <p className="sg-sub">Tap the button on the phone or computer where you asked for the link.</p>
      <input type="hidden" name="token" value={token} />
      <button className="sg-btn" type="submit">Open staging</button>
    </form> : <p className="sg-wrong">That link doesn't look right. Ask for a new one.</p>}
    <a className="sg-sub" href="/staging-gate?code=1">On another device? Use the code from your email.</a>
    <a className="sg-sub" href="/staging-gate">Ask for a new link</a>
  </GateShell>
}
