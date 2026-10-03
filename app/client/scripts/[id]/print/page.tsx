// /client/scripts/<id>/print: the script as paper (SPEC §14 phone moment 7, "PDF in house style"): the BASE text in
// VIDEO | AUDIO columns with the read time per row; the browser's Print → Save as PDF makes the file.
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { roleOf, sessionFacts, UUID } from "@/lib/scripts/server/access"
import { catchUp, withLive } from "@/lib/scripts/server/registry"
import { pmFromYDoc, renderScript } from "@/lib/scripts/doc"
import { clock } from "@/lib/scripts/timing"
import { Wordmark } from "@/app/client/ui"
import { PrintButton } from "./print-button"
import "../../scripts.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Script" }

export default async function PrintScript({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()
  const facts = await sessionFacts()
  if (!facts) redirect(`/login?redirect=${encodeURIComponent(`/client/scripts/${params.id}/print`)}`)
  if (!(await roleOf(params.id, facts))) notFound()
  const script = await db.script.findUnique({
    where: { id: params.id },
    select: { title: true, job: true, reader: true, pace_wpm: true, target_seconds: true, organization: { select: { name: true, short_name: true } } },
  })
  if (!script) notFound()
  const doc = await withLive(params.id, async (l) => {
    await catchUp(l)
    return pmFromYDoc(l.doc)
  })
  const r = renderScript(doc, { wpm: script.pace_wpm, target_s: script.target_seconds })
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  return (
    <main className="sc-print">
      <div className="sc-print-bar">
        <a href={`/client/scripts/${params.id}`}>← Back to the script</a>
        <PrintButton />
      </div>
      <header className="sc-print-head">
        <Wordmark />
        <p className="sc-print-meta">
          {[script.organization ? script.organization.short_name ?? script.organization.name : null, script.job, script.reader ? `read by ${script.reader}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1>{script.title}</h1>
        <p className="sc-print-meta">
          {r.label} at {r.pace_wpm} words a minute · {today}
          {r.pending_suggestions ? ` · ${r.pending_suggestions} pending suggestion${r.pending_suggestions === 1 ? "" : "s"} not included` : ""}
        </p>
      </header>
      <table className="sc-print-table">
        <thead>
          <tr>
            <th>Video</th>
            <th>Audio</th>
            <th className="t">Time</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, i) => (
            <tr key={row.row_id ?? i}>
              <td className="v">{row.video.map((v, k) => <p key={k}>{v}</p>)}</td>
              <td>
                {row.speaker ? <p className="sp">{row.speaker}:</p> : null}
                {row.audio.map((a, k) => (
                  <p key={k}>{a}</p>
                ))}
                {row.directions.map((d, k) => (
                  <p key={`d${k}`} className="dir">({d})</p>
                ))}
              </td>
              <td className="t">{row.seconds === null ? "—" : clock(row.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
