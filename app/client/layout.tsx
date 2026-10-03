import type { Metadata, Viewport } from "next"
import { Barlow_Condensed, Lobster } from "next/font/google"
import "./client.css"

// The thin outer frame for everything under /client: fonts, the design system,
// no auth. The signed-in shell lives in (app)/layout.tsx; the staff "View as
// client" picker (view-as/) has its own.
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Your account · Oliver Street Creative", template: "%s · Oliver Street Creative" },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: "#141412", width: "device-width", initialScale: 1 }
export const dynamic = "force-dynamic"

export default function ClientFrame({ children }: { children: React.ReactNode }) {
  return <div className={`cs ${barlow.variable} ${lobster.variable}`}>{children}</div>
}
