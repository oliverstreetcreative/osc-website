// Staging's password page (client-website SPEC §32 v2). Middleware shows it in place of any page asked for without a
// pass (the address stays what was tapped); the form posts to /staging-gate/enter, which goes on to `next`. The
// read-only username lets Safari and iCloud Keychain save the pair; only the password is checked.
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IS_STAGING } from "@/lib/site-env"
import { GATE_ENTER, safeNext } from "@/lib/staging/gate"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Staging · Oliver Street Creative", robots: { index: false, follow: false } }

const CSS = `
.sg { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: #141412; color: #f7f6f3; font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.sg-card { width: 100%; max-width: 360px; display: grid; gap: 14px; }
.sg-brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(247, 246, 243, 0.66); }
.sg-h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.sg-sub { color: rgba(247, 246, 243, 0.66); font-size: 15px; line-height: 1.45; }
.sg-note { background: rgba(224, 120, 48, 0.14); border: 1px solid rgba(224, 120, 48, 0.4); border-radius: 10px; padding: 12px 14px; font-size: 15px; line-height: 1.45; }
.sg-label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: rgba(247, 246, 243, 0.8); }
.sg-input { height: 48px; border-radius: 10px; border: 1px solid rgba(247, 246, 243, 0.22); background: #1f1f1c; color: #f7f6f3; padding: 0 14px; font: inherit; font-size: 16px; }
.sg-input[readonly] { color: rgba(247, 246, 243, 0.66); }
.sg-input:focus { outline: 2px solid #e07830; outline-offset: 1px; border-color: transparent; }
.sg-wrong { color: #ffb4a8; font-size: 15px; }
.sg-btn { height: 50px; border: 0; border-radius: 999px; background: #e07830; color: #141412; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 4px; }
.sg-btn:focus-visible { outline: 2px solid #f7f6f3; outline-offset: 2px; }
`

export default function StagingGate({ searchParams }: { searchParams: { next?: string | string[]; wrong?: string } }) {
  if (!IS_STAGING) notFound()
  const next = safeNext(typeof searchParams.next === "string" ? searchParams.next : "/")
  const wrong = searchParams.wrong === "1"
  const demoEnded = /^\/login\?(?:.*&)?demo_ended=1(?:&|$)/.test(next)
  return (
    <main className="sg" data-staging-gate="">
      <style>{CSS}</style>
      <form method="post" action={GATE_ENTER} className="sg-card">
        <p className="sg-brand">Oliver Street Creative</p>
        <h1 className="sg-h1">Staging</h1>
        {demoEnded ? (
          <p className="sg-note" role="status">
            This demo has ended. Ask Oliver Street Creative for a new link.
          </p>
        ) : (
          <p className="sg-sub">Work in progress. Enter the password to look around.</p>
        )}
        <label className="sg-label">
          Username
          <input className="sg-input" name="username" value="osc" readOnly autoComplete="username" />
        </label>
        <label className="sg-label">
          Password
          <input className="sg-input" name="password" type="password" required autoFocus={!demoEnded} autoComplete="current-password" />
        </label>
        <input type="hidden" name="next" value={next} />
        {wrong ? (
          <p className="sg-wrong" role="alert">
            That password didn’t work. Try again.
          </p>
        ) : null}
        <button className="sg-btn" type="submit">
          Enter
        </button>
      </form>
    </main>
  )
}
