import localFont from "next/font/local"

// Exact Latin font bytes already vendored for the OSC blog. Builds need no
// Google Fonts connection; public pages, portal and login use one definition.
export const inter = localFont({ src: "./font-assets/inter-normal-100-900-latin.woff2", weight: "100 900", variable: "--font-inter", display: "swap" })
export const ebGaramond = localFont({ src: "./font-assets/ebgaramond-italic-400-latin.woff2", weight: "400", style: "italic", variable: "--font-garamond", display: "swap" })
export const barlow = localFont({ src: [
  { path: "./font-assets/barlowcondensed-normal-600-latin.woff2", weight: "600" },
  { path: "./font-assets/barlowcondensed-normal-700-latin.woff2", weight: "700" },
], variable: "--font-barlow", display: "swap" })
export const lobster = localFont({ src: "./font-assets/lobster-normal-400-latin.woff2", weight: "400", variable: "--font-lobster", display: "swap" })
