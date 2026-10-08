import Link from "next/link"
import { redirect } from "next/navigation"
import { requireClientContext } from "@/lib/client/context"
import { seesMoney } from "@/lib/client/money"
import { answersOf, draftFor, filesOf, liveFiles } from "@/lib/client/request-drafts"
import { STEPS, summary } from "@/lib/client/request-form"
import { OSC_PHONE, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Review and send" }
export const dynamic = "force-dynamic"

const ERRORS: Record<string, string> = {
  limit: "That's today's limit for new requests. Text Sam instead, or send this tomorrow: it's saved.",
}

// The last screen (SPEC §31 v2): every answer, grouped, each group with Change; then Send to Sam.
export default async function Review({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const ctx = await requireClientContext()
  if (ctx.viewing) redirect("/client/start/look/about")
  const draft = await draftFor(ctx, params.id)
  if (!draft) redirect("/client/start")
  const files = liveFiles(filesOf(draft.assets))
  const groups = summary(answersOf(draft.answers), { seesMoney: seesMoney(ctx.role), files, later: draft.assets_later })
  const error = searchParams.error ? ERRORS[searchParams.error] ?? null : null
  return (
    <main className="cs-main">
      <p className="cs-eyebrow">Start a project · Review</p>
      <div className="cs-q-progress" aria-hidden>
        <i style={{ width: "100%" }} />
      </div>
      <h1 className="cs-title" style={{ marginTop: 10 }}>Review and send</h1>
      <p className="cs-lede">Here&rsquo;s everything you told us. Change anything before it goes to Sam.</p>
      {error ? <p className="cs-form-error" role="alert" style={{ marginTop: 16 }}>{error}</p> : null}

      {groups.map((g) => (
        <section key={g.step} className="cs-section">
          <h2 className="cs-h2">
            <span>{g.title}</span>
            <Link href={`/client/start/${draft.id}/${g.step}`}>Change</Link>
          </h2>
          {g.rows.length ? (
            <div className="cs-rows">
              {g.rows.map((r, i) => (
                <div key={i} className="cs-row">
                  <span className="cs-row-main">
                    {r.label ? <small>{r.label}</small> : null}
                    <strong className="cs-q-answer">{r.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="cs-q-help">Nothing here yet.</p>
          )}
        </section>
      ))}

      <form action="/client/start/send" method="post" className="cs-section">
        <input type="hidden" name="id" value={draft.id} />
        <button className="cs-btn" style={{ width: "100%" }}>Send to Sam</button>
      </form>
      <p className="cs-lede" style={{ textAlign: "center", marginTop: 14 }}>
        Rather talk? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
      </p>
      <p style={{ textAlign: "center", marginTop: 6 }}>
        <span className="cs-q-help">{STEPS.length} steps, saved as you went.</span>
      </p>
    </main>
  )
}
