import { Barlow_Condensed, Lobster } from "next/font/google"
import { themeFromCookie } from "@/lib/client/theme"
import "../client/client.css"

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata = { title: "Sign in · Oliver Street Creative" }
export const dynamic = "force-dynamic"

// A second root for the client site (SPEC §20): it carries the device's Appearance choice too.
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const theme = await themeFromCookie()
  return <div className={`cs ${barlow.variable} ${lobster.variable}`} data-theme={theme}>{children}</div>
}
