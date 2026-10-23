"use client"
// The signed-in shell itself broke (SPEC §29 v2), so its report sheet isn't on screen: this page brings its own.
import { useEffect } from "react"
import { ReportLink, ReportSheet } from "./report-sheet"

export default function ClientError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`client site error ${error.digest ?? ""}`.trim())
  }, [error])
  return (
    <main className="cs-main">
      <div className="cs-card cs-pad" style={{ marginTop: 48 }}>
        <h1 className="cs-title" style={{ fontSize: 24, marginTop: 0 }}>Your account didn&rsquo;t load.</h1>
        <p>Something went wrong on our side. Try again in a moment, or tell Sam what you were doing.</p>
        <p style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" className="cs-btn" onClick={reset}>Try again</button>
          <ReportLink label="Tell Sam what happened" />
          <a href="sms:+18595121419">Text Sam</a>
        </p>
      </div>
      <ReportSheet />
    </main>
  )
}
