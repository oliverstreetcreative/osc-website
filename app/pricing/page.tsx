import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IS_STAGING } from "@/lib/site-env"
import Estimator from "./estimator"

// ---------------------------------------------------------------------------
// /pricing - the price estimator PROTOTYPE (matter price-estimator, 9/30/26).
// Staging only: 404 anywhere else until Sam approves it. Unlisted: no nav,
// no sitemap. The formula lives in lib/estimator/pricing.ts and is reached
// only through POST /api/estimate; this page holds no rates.
// Try ?show=floor for the "from $X" version instead of the range (OPEN for Sam).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "What will it cost? | Oliver Street Creative",
  description: "Pick what you need and see where projects like yours usually land.",
  robots: { index: false, follow: false },
}

export default function PricingPage({ searchParams }: { searchParams: { show?: string } }) {
  if (!IS_STAGING && process.env.NODE_ENV === "production") notFound()
  const mode = searchParams?.show === "floor" ? "floor" : "range"
  return (
    <div className="pe">
      <header className="pe-top">
        <Link href="/" aria-label="Oliver Street Creative home">
          <img src="/logo.png" alt="Oliver Street Creative" />
        </Link>
        <span className="pe-draft">Draft · 9/30/26<span className="wide-only"> · prices not final</span></span>
      </header>
      <main className="pe-main">
        <div className="pe-eyebrow">Video pricing</div>
        <h1 className="pe-h1">What will it cost?</h1>
        <p className="pe-lede">Pick what you need. We&rsquo;ll show you where projects like yours usually land.</p>
        <Estimator mode={mode} />
        <p className="pe-fine">
          Every project gets a real quote after we talk. Travel outside Cincinnati and Northern Kentucky is extra, at cost.
        </p>
        <div className="pe-links">
          <Link href={mode === "floor" ? "/pricing" : "/pricing?show=floor"}>
            Staging try-out: show {mode === "floor" ? "a range" : "a “from” price"} instead
          </Link>
        </div>
      </main>
      <footer className="pe-foot">
        <Link href="/">Home</Link>
        <Link href="/#work">Work</Link>
        <Link href="/#contact">Contact</Link>
        <div style={{ marginTop: "14px" }}>© {new Date().getFullYear()} Oliver Street Creative · Covington, KY</div>
      </footer>
    </div>
  )
}
