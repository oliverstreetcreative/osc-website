"use client"
// A page inside the signed-in shell broke (SPEC §29 v2). Say so plainly, offer Try again, and put the report link right
// here: the shell (and its report sheet) is still on screen, and the diagnostics recorder has the error.
import { useEffect } from "react"
import { ReportLink } from "@/app/client/report-sheet"

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest ties this to the server's log line; the recorder keeps it for the report.
    console.error(`page error ${error.digest ?? ""}`.trim())
  }, [error])
  return (
    <main className="cs-main">
      <div className="cs-card cs-pad" style={{ marginTop: 24 }}>
        <h1 className="cs-title" style={{ fontSize: 24, marginTop: 0 }}>This page didn&rsquo;t load.</h1>
        <p>Something went wrong on our side. Try again, or tell Sam what you were doing.</p>
        <p style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" className="cs-btn" onClick={reset}>Try again</button>
          <ReportLink label="Tell Sam what happened" />
        </p>
      </div>
    </main>
  )
}
