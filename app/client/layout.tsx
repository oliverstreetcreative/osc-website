import type { Metadata, Viewport } from "next"
import { Barlow_Condensed, Lobster } from "next/font/google"
import { themeFromCookie } from "@/lib/client/theme"
import "./client.css"

// The thin outer frame for everything under /client: fonts, the design system,
// no auth. The signed-in shell lives in (app)/layout.tsx; the staff "View as
// client" picker (view-as/) has its own. data-theme (SPEC §20): the device's
// Appearance choice, read here so the page renders in it without a flash.
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Your account · Oliver Street Creative", template: "%s · Oliver Street Creative" },
  robots: { index: false, follow: false },
}
// The header is dark in both themes, so one theme colour for the phone's status bar.
export const viewport: Viewport = { themeColor: "#141412", width: "device-width", initialScale: 1 }
export const dynamic = "force-dynamic"

export default async function ClientFrame({ children }: { children: React.ReactNode }) {
  const theme = await themeFromCookie()
  return <div className={`cs ${barlow.variable} ${lobster.variable}`} data-theme={theme}>{children}</div>
}
