import { Barlow_Condensed, Lobster } from "next/font/google"

// Same faces as the client site (app/client/layout.tsx), so the wordmark and the
// public pages render identically. 700 is for the big numbers (the shoot-day hub's
// call-time face).
export const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow", display: "swap" })
export const lobster = Lobster({ subsets: ["latin"], weight: ["400"], variable: "--font-lobster", display: "swap" })
