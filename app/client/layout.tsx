import type { Metadata, Viewport } from "next"
import { Barlow_Condensed, Lobster } from "next/font/google"
import { LOOK_SCRIPT } from "@/lib/client/theme"
import { DIAG_SCRIPT } from "@/lib/support/recorder"
import { LookApplier } from "./look"
import "./client.css"

// The thin outer frame for everything under /client: fonts, the design system,
// no auth. The signed-in shell lives in (app)/layout.tsx; the staff "View as
// client" picker (view-as/) has its own. Appearance (SPEC §20, the hub's
// conventions): .cs-app marks a portal root (the public site's .cs never
// darkens); the inline script applies this device's choice before paint.
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Your account · Oliver Street Creative", template: "%s · Oliver Street Creative" },
  robots: { index: false, follow: false },
}
// The header is dark in both appearances, so one theme colour for the phone's status bar.
export const viewport: Viewport = { themeColor: "#141412", width: "device-width", initialScale: 1 }
export const dynamic = "force-dynamic"

export default function ClientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cs cs-app ${barlow.variable} ${lobster.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
      {/* "Something's wrong?" (SPEC §29 v2): the page's recent errors, recorded from the start. */}
      <script dangerouslySetInnerHTML={{ __html: DIAG_SCRIPT }} />
      <LookApplier />
      {children}
    </div>
  )
}
