import { Barlow_Condensed, Lobster } from "next/font/google"
import "../client/client.css"

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-barlow", display: "swap" })
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })

export const metadata = { title: "Sign in · Oliver Street Creative" }

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`cs ${barlow.variable} ${lobster.variable}`}>{children}</div>
}
