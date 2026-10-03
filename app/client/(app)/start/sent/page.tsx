import Link from "next/link"
import { notFound } from "next/navigation"
import { Check } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { kindLabel, timingLabel } from "@/lib/client/requests"
import { OSC_PHONE, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Sent" }

export default async function Sent({ searchParams }: { searchParams: { id?: string; repeat?: string } }) {
  const ctx = await requireClientContext()
  const id = searchParams.id ?? ""
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  // Scoped to this org: another client's request id shows nothing.
  const r = await db.projectRequest.findFirst({ where: { id, organization_id: ctx.org.id } })
  if (!r) notFound()

  return (
    <main className="cs-main">
      <div className="cs-card cs-calm" style={{ marginTop: 8 }}>
        <span className="cs-calm-dot"><Check size={22} /></span>
        <div>
          <h3>{searchParams.repeat ? "You already sent this." : "Sent."}</h3>
          <p>Sam will be in touch.</p>
        </div>
      </div>

      <section className="cs-section">
        <div className="cs-rows">
          <div className="cs-row"><span className="cs-row-main"><small>Kind</small><strong>{kindLabel(r.kind, r.like_project)}</strong></span></div>
          <div className="cs-row"><span className="cs-row-main"><small>When</small><strong>{timingLabel(r.timing, r.due_on)}</strong></span></div>
          {r.about ? (
            <div className="cs-row"><span className="cs-row-main"><small>What it&rsquo;s for</small><strong style={{ whiteSpace: "pre-wrap", fontWeight: 400 }}>{r.about}</strong></span></div>
          ) : null}
        </div>
      </section>

      <p className="cs-lede" style={{ marginTop: 18 }}>
        Rather talk? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
      </p>
      <p style={{ marginTop: 18 }}><Link className="cs-link" href="/client/projects">Back to your projects</Link></p>
    </main>
  )
}
