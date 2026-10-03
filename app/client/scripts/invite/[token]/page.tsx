// /client/scripts/invite/<token>: the page an invite link opens (SPEC §14 v4 #10). Loading it spends nothing (mail
// scanners and link previews load links); the TAP on "Open the script" does: it signs the person in and lands them on
// the script. A used or expired link offers "Send me a new link".
import type { Metadata } from "next"
import { readInvite } from "@/lib/scripts/server/invites"
import { Wordmark } from "@/app/client/ui"
import "../../scripts.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "A script for you", robots: { index: false, follow: false } }

const masked = (email?: string | null) => {
  if (!email) return null
  const [u, d] = email.split("@")
  return `${u.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(6, u.length - 1)))}@${d}`
}

export default async function InvitePage({ params, searchParams }: { params: { token: string }; searchParams: { sent?: string } }) {
  const inv = await readInvite(params.token)
  return (
    <div className="sc-page">
      <header className="cs-top">
        <div className="cs-top-in">
          <Wordmark />
        </div>
      </header>
      <main className="cs-main sc-main sc-invite">
        {inv.ok ? (
          <>
            <p className="cs-eyebrow">A script for you</p>
            <h1 className="cs-title">{inv.title}</h1>
            <p className="cs-lede">{inv.sharer} at Oliver Street Creative shared this script with you. Open it to read it, and to suggest changes if you&rsquo;ve been asked to.</p>
            <form method="post" action="/api/scripts/invite/accept" style={{ marginTop: 20 }}>
              <input type="hidden" name="token" value={params.token} />
              <button className="cs-btn">Open the script</button>
            </form>
            <p className="sc-loading" style={{ marginTop: 16 }}>This signs you in on this device. No password.</p>
          </>
        ) : searchParams.sent ? (
          <>
            <h1 className="cs-title">Check your email</h1>
            <p className="cs-lede">We sent a new link to {masked(inv.email) ?? "your email"}.</p>
          </>
        ) : inv.why === "unknown" ? (
          <>
            <h1 className="cs-title">This link doesn&rsquo;t work</h1>
            <p className="cs-lede">Ask whoever sent it for a new one.</p>
          </>
        ) : inv.why === "revoked" ? (
          <>
            <h1 className="cs-title">This script isn&rsquo;t shared with you any more</h1>
            <p className="cs-lede">If that&rsquo;s a mistake, ask Sam to share it again.</p>
          </>
        ) : (
          <>
            <h1 className="cs-title">{inv.why === "spent" ? "This link has been used" : "This link has expired"}</h1>
            <p className="cs-lede">{inv.title ? <>The script <b>{inv.title}</b> is still shared with you. </> : null}Get a fresh link by email.</p>
            {inv.email ? (
              <form method="post" action="/api/scripts/invite/renew" style={{ marginTop: 20 }}>
                <input type="hidden" name="token" value={params.token} />
                <button className="cs-btn">Send me a new link</button>
              </form>
            ) : (
              <p className="cs-lede">Ask Sam to send you a new link.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
