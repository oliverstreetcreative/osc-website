import Link from "next/link"
import { Plus, ArrowRight, MessageSquare } from "lucide-react"
import type { ClientContext } from "@/lib/client/context"
import { canRequest, kindLabel, timingLabel } from "@/lib/client/requests"
import { day } from "@/lib/client/format"
import { OSC_PHONE, OSC_SMS } from "@/app/client/ui"

type Req = {
  id: string
  kind: string
  like_project: string | null
  timing: string
  due_on: Date | null
  status: string
  created_at: Date
}

/** The quiet card at the bottom of Home and Projects (never above Needs you). */
export function StartCard({ ctx }: { ctx: ClientContext }) {
  // Staff viewing see the client's card; the page itself has Send disabled.
  if (canRequest(ctx) || ctx.viewing) {
    return (
      <section className="cs-section">
        <Link href="/client/start" className="cs-card cs-row" style={{ borderRadius: 16 }}>
          <span className="cs-ico"><Plus /></span>
          <span className="cs-row-main">
            <strong>Start a new project</strong>
            <small>Tell Sam what you have in mind</small>
          </span>
          <ArrowRight size={18} color="var(--muted)" />
        </Link>
      </section>
    )
  }
  return (
    <section className="cs-section">
      <a href={OSC_SMS} className="cs-card cs-row" style={{ borderRadius: 16 }}>
        <span className="cs-ico"><MessageSquare /></span>
        <span className="cs-row-main">
          <strong>Want another video?</strong>
          <small>Text Sam · {OSC_PHONE}</small>
        </span>
      </a>
    </section>
  )
}

/** Her open requests on Projects, until Sam's project (with from_request) arrives. */
export function RequestCards({ requests }: { requests: Req[] }) {
  if (!requests.length) return null
  const threeDaysAgo = Date.now() - 3 * 86_400_000
  return (
    <section className="cs-section" style={{ marginTop: 20 }}>
      <div className="cs-rows">
        {requests.map((r) => (
          <div key={r.id} className="cs-row" style={{ flexWrap: "wrap" }}>
            <span className="cs-row-main">
              <strong>{kindLabel(r.kind, r.like_project)} · {timingLabel(r.timing, r.due_on)}</strong>
              <small>
                {r.status === "in_review"
                  ? `Asked ${day(r.created_at, { month: "short", day: "numeric", timeZone: "America/New_York" })} · Sam has it`
                  : `Asked ${day(r.created_at, { month: "short", day: "numeric", timeZone: "America/New_York" })} · Sam will be in touch`}
              </small>
              {r.created_at.getTime() < threeDaysAgo ? (
                <small>
                  Haven&rsquo;t heard back? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
                </small>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
