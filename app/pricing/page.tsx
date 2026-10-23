import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IS_STAGING } from "@/lib/site-env"
import { vocab } from "@/lib/estimator/vocab"
import Estimator from "./estimator"

// ---------------------------------------------------------------------------
// /pricing - the SIMPLE quote (client-facing), matter price-estimator.
// Sam 10/2: kind of video, level of quality, how strict the deadline,
// "Oliver Street handles..." checkboxes, optional day count + pickup days.
// Output is a RANGE only. The formula is lib/estimator/engine.ts, reached only
// through POST /api/estimate; this page gets labels, never prices.
// The DETAILED (internal) quote is /quote-desk, gated.
// Staging only: 404 in production until Sam approves. Unlisted, noindex.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "What will it cost? | Oliver Street Creative",
  description: "Tell us about your video and see where projects like yours usually land.",
  robots: { index: false, follow: false },
}

export default function PricingPage() {
  if (!IS_STAGING && process.env.NODE_ENV === "production") notFound()
  return (
    <div className="pe">
      <header className="pe-top">
        <Link href="/" aria-label="Oliver Street Creative home">
          <img src="/logo.png" alt="Oliver Street Creative" />
        </Link>
        <span className="pe-draft">Draft · 10/2/26<span className="wide-only"> · prices not final</span></span>
      </header>
      <main className="pe-main">
        <div className="pe-eyebrow">Video pricing</div>
        <h1 className="pe-h1">What will it cost?</h1>
        <p className="pe-lede">Tell us about your video. We&rsquo;ll show you where projects like yours usually land.</p>
        <Estimator vocab={vocab()} />
        <p className="pe-fine">
          Every project gets a real quote after we talk. Travel outside Cincinnati and Northern Kentucky is extra, at cost.
        </p>
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
