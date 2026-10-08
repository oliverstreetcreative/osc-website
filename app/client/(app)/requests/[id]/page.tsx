import Link from "next/link"
import { notFound } from "next/navigation"
import { Paperclip } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { seesMoney } from "@/lib/client/money"
import { canRequest, kindLabel, timingLabel } from "@/lib/client/requests"
import { answersOf, filesOf, liveFiles } from "@/lib/client/request-drafts"
import { summary } from "@/lib/client/request-form"
import { HelpFooter, OSC_PHONE, OSC_SMS, PhaseTracker } from "@/app/client/ui"
import { requestName, requestStatus } from "@/app/client/start-cards"

export const metadata = { title: "Your project request" }
export const dynamic = "force-dynamic"

// A sent request, read-only (SPEC §31 v2): what she told us, its files by name, where it stands. No edits after Send:
// "Need to change something? Text Sam". Org-scoped; budget, quoted price and billing only for people who see money.
export default async function RequestPage({ params }: { params: { id: string } }) {
  const ctx = await requireClientContext()
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const r = await db.projectRequest.findFirst({
    where: { id: params.id, organization_id: ctx.org.id, status: { in: ["pending", "sent", "in_review"] } },
  })
  if (!r) notFound()
  const files = liveFiles(filesOf(r.assets))
  const { line, nudge } = requestStatus(r)
  const groups =
    r.form_version >= 5
      ? summary(answersOf(r.answers), { seesMoney: seesMoney(ctx.role), files, later: r.assets_later && !files.length })
      : [
          {
            step: "project" as const,
            title: "Your request",
            rows: [
              { label: "Kind", value: kindLabel(r.kind, r.like_project) },
              { label: "When", value: timingLabel(r.timing, r.due_on) },
              ...(r.about ? [{ label: "What it's for", value: r.about }] : []),
            ].filter((x) => x.value),
          },
        ]
  const mayUpload = r.assets_later && !files.length && !ctx.viewing && (r.person_id === ctx.user.id || canRequest(ctx))
  return (
    <>
      <header className="cs-hero">
        <div className="cs-hero-in">
          <Link href="/client" className="cs-back">Home</Link>
          <p className="cs-eyebrow">New project · {ctx.org.short_name ?? ctx.org.name}</p>
          <h1>{requestName(r)}</h1>
          <p className="cs-hero-line">{line}</p>
          <PhaseTracker phase="quote" />
        </div>
      </header>
      <main className="cs-main" style={{ paddingTop: 8 }}>
        {nudge ? (
          <div className="cs-card cs-pad" style={{ marginTop: 14 }}>
            <p>
              Haven&rsquo;t heard back? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
            </p>
          </div>
        ) : null}
        {mayUpload ? (
          <div className="cs-card cs-need" style={{ marginTop: 14 }}>
            <div className="cs-need-top">
              <span className="cs-eyebrow"><Paperclip size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Your brand assets</span>
            </div>
            <h3>Logo (vector if you have it), style guide, fonts</h3>
            <div className="cs-need-act">
              <Link className="cs-btn" href={`/client/requests/${r.id}/assets`}>Upload</Link>
            </div>
          </div>
        ) : null}
        {groups.map((g) =>
          g.rows.length ? (
            <section key={g.step} className="cs-section">
              <h2 className="cs-h2"><span>{g.title}</span></h2>
              <div className="cs-rows">
                {g.rows.map((row, i) => (
                  <div key={i} className="cs-row">
                    <span className="cs-row-main">
                      {row.label ? <small>{row.label}</small> : null}
                      <strong className="cs-q-answer">{row.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null,
        )}
        <p className="cs-lede" style={{ marginTop: 22 }}>
          Need to change something? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </p>
        <HelpFooter />
      </main>
    </>
  )
}
