import type { Metadata, Viewport } from "next"
import { Barlow_Condensed, Lobster } from "next/font/google"
import { requireClientContext } from "@/lib/client/context"
import { ImpersonationBanner } from "@/components/ImpersonationBanner"
import { Wordmark } from "./ui"
import { Nav, Tabs } from "./nav"
import "./client.css"

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Your account · Oliver Street Creative", template: "%s · Oliver Street Creative" },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: "#141412", width: "device-width", initialScale: 1 }
export const dynamic = "force-dynamic"

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireClientContext()
  const initials = (ctx.user.first_name ?? ctx.user.name ?? "?").trim().slice(0, 1).toUpperCase()
  const showOrgs = ctx.orgs.length > 1

  return (
    <div className={`cs ${barlow.variable} ${lobster.variable}`}>
      <ImpersonationBanner />
      <header className="cs-top">
        <div className="cs-top-in">
          <a href="/client" aria-label="Home"><Wordmark /></a>
          <Nav />
          <div className="cs-top-r">
            {showOrgs ? (
              <details className="cs-menu">
                <summary className="cs-chip-btn"><span>{ctx.org.short_name ?? ctx.org.name}</span> ▾</summary>
                <div className="cs-pop">
                  {ctx.orgs.map((o) => (
                    <form key={o.id} action="/client/org" method="post">
                      <input type="hidden" name="slug" value={o.slug} />
                      <button className={o.id === ctx.org.id ? "on" : ""}>{o.name}</button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
            <details className="cs-menu">
              <summary className="cs-avatar" aria-label="Account">{initials}</summary>
              <div className="cs-pop">
                <div className="cs-pop-head">
                  <strong>{ctx.user.name}</strong>
                  <small>{ctx.user.email}</small>
                </div>
                <a href="/client/calendar">Calendar feed</a>
                <form action="/client/signout" method="post"><button>Sign out</button></form>
              </div>
            </details>
          </div>
        </div>
      </header>
      {children}
      <Tabs />
    </div>
  )
}
