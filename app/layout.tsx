import type React from "react"
import type { Metadata } from "next"
import { Inter, EB_Garamond } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-garamond",
})

export const metadata: Metadata = {
  title: "Oliver Street Creative - Video Production in Covington, KY",
  description:
    "Professional video production company in Covington, KY. We create authentic stories that build trust and drive results. From corporate videos to marketing content - we win when you win.",
  keywords:
    "video production, Covington KY, corporate video, marketing video, Cincinnati video production, commercial video, documentary",
  authors: [{ name: "Oliver Street Creative" }],
  openGraph: {
    title: "Oliver Street Creative - Professional Video Production",
    description: "Stories that move hearts, build trust, and close deals. Video production in Covington, KY.",
    url: "https://oliverstreetcreative.com",
    siteName: "Oliver Street Creative",
    images: [
      {
        url: "https://oliverstreetcreative.com/media/logo.png",
        width: 1200,
        height: 630,
        alt: "Oliver Street Creative Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Oliver Street Creative - Professional Video Production",
    description: "Stories that move hearts, build trust, and close deals. Video production in Covington, KY.",
    images: ["https://oliverstreetcreative.com/media/logo.png"],
  },
  viewport: "width=device-width, initial-scale=1",
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${ebGaramond.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
