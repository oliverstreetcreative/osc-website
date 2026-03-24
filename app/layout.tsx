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
  metadataBase: new URL("https://staging.oliverstreetcreative.com"),
  title: "Oliver Street Creative | Brand Story Video Production | Cincinnati & Northern Kentucky",
  description:
    "Full-service video production in Covington, KY serving Greater Cincinnati. Strategic brand stories for businesses and nonprofits — concept to delivery.",
  keywords:
    "video production Cincinnati, corporate video production, nonprofit video production, brand storytelling, Covington KY video, marketing video, full-service video production, documentary, commercial video, Northern Kentucky videographer",
  authors: [{ name: "Oliver Street Creative" }],
  alternates: {
    canonical: "https://oliverstreetcreative.com/",
  },
  openGraph: {
    title: "Oliver Street Creative — Strategic Video for Businesses & Nonprofits",
    description: "Full-service video production in Covington, KY. We craft cinematic stories that build trust, drive donations, and close deals. Serving Cincinnati & Northern Kentucky.",
    url: "https://oliverstreetcreative.com",
    siteName: "Oliver Street Creative",
    images: [
      {
        url: "/og-image.png",
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
    title: "Oliver Street Creative — Strategic Video for Businesses & Nonprofits",
    description: "Full-service video production in Covington, KY. Cinematic stories that build trust and drive results.",
    images: ["/og-image.png"],
  },
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${ebGaramond.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VideoProductionCompany",
              "name": "Oliver Street Creative",
              "url": "https://oliverstreetcreative.com",
              "logo": "https://oliverstreetcreative.com/logo.png",
              "description": "Full-service video production company in Covington, KY serving Cincinnati and Northern Kentucky. Strategic brand storytelling for businesses, nonprofits, and government.",
              "telephone": "+1-859-512-1419",
              "email": "hello@oliverstreetcreative.com",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "521 Oliver St",
                "addressLocality": "Covington",
                "addressRegion": "KY",
                "postalCode": "41014",
                "addressCountry": "US"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": 39.0837,
                "longitude": -84.5085
              },
              "areaServed": [
                {"@type": "City", "name": "Cincinnati", "sameAs": "https://en.wikipedia.org/wiki/Cincinnati"},
                {"@type": "City", "name": "Covington", "sameAs": "https://en.wikipedia.org/wiki/Covington,_Kentucky"},
                {"@type": "State", "name": "Northern Kentucky"}
              ],
              "priceRange": "$$",
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "09:00",
                "closes": "17:00"
              }
            })
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
