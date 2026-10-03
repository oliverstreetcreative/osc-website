import { requireClientContext } from "@/lib/client/context"
import { KIND_CHOICES, TIMING_CHOICES, MAX_ABOUT, canRequest, lastDeliveredProject, limitReached, newFormKey } from "@/lib/client/requests"
import { todayUTC } from "@/lib/client/format"
import { OSC_PHONE, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Start a new project" }

const ERRORS: Record<string, string> = {
  invalid: "Pick a kind of video and when you need it.",
  past: "That date has passed. Pick a new one.",
  org: "Something changed on this page. Try again.",
}

// SPEC §17 v2: the client asks, Sam quotes. No price anywhere. One short page; the
// browser won't send without a kind and a timing, so a slip never wipes what she typed.
export default async function StartProject({ searchParams }: { searchParams: { error?: string } }) {
  const ctx = await requireClientContext()
  const viewing = !!ctx.viewing
  const may = canRequest(ctx) || viewing // staff (and the demo) see the client's page, with Send disabled
  // Today's requests used up: say so BEFORE she types a paragraph, not after.
  const full = !viewing && may && (await limitReached(ctx))
  const last = await lastDeliveredProject(ctx.org.id)
  const today = todayUTC().toISOString().slice(0, 10)
  const error = searchParams.error ? ERRORS[searchParams.error] ?? null : null

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Start a new project</h1>

      {!may || full || searchParams.error === "limit" ? (
        <div className="cs-card cs-pad" style={{ marginTop: 20 }}>
          <p>{may ? "That's today's limit." : "Want another video?"}</p>
          <a className="cs-btn" style={{ marginTop: 14 }} href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </div>
      ) : (
        <form action="/client/start/send" method="post" className="cs-start">
          <input type="hidden" name="org" value={ctx.org.slug} />
          <input type="hidden" name="key" value={newFormKey()} />
          {error ? <p className="cs-form-error" role="alert">{error}</p> : null}

          <fieldset>
            <legend>What kind of video?</legend>
            {last ? (
              <label className="cs-choice">
                <input type="radio" name="kind" value={`like:${last.slug}`} required />
                <span><b>Like &ldquo;{last.name}&rdquo;</b><small>The same kind of video as last time</small></span>
              </label>
            ) : null}
            {KIND_CHOICES.map((k) => (
              <label key={k.id} className="cs-choice">
                <input type="radio" name="kind" value={k.id} required />
                <span><b>{k.label}</b><small>{k.note}</small></span>
              </label>
            ))}
          </fieldset>

          <fieldset className="cs-timing">
            <legend>When do you need it?</legend>
            {TIMING_CHOICES.map((t) => (
              <label key={t.id} className="cs-choice">
                <input type="radio" name="timing" value={t.id} required />
                <span>
                  <b>{t.label}</b>
                  {t.note ? <small>{t.note}</small> : null}
                </span>
              </label>
            ))}
            {/* Outside the label on purpose: a tap inside a label doesn't pick its radio. Shown only while
                "By a date" is picked (CSS :has), so a date can't ride along with another choice. */}
            <label className="cs-field cs-date-wrap">
              <span>Date, if you have one</span>
              <input type="date" name="due" min={today} className="cs-date-input" />
            </label>
          </fieldset>

          <label className="cs-field">
            <span>What&rsquo;s it for?</span>
            <textarea name="about" rows={4} maxLength={MAX_ABOUT} placeholder="Optional" />
          </label>

          <button className="cs-btn" disabled={viewing} style={{ width: "100%" }}>Send to Sam</button>
          {viewing ? (
            <p className="cs-lede" style={{ textAlign: "center" }}>
              {ctx.viewing?.demo ? "Off in the demo." : "Read-only while viewing."}
            </p>
          ) : null}
          <p className="cs-lede" style={{ textAlign: "center", marginTop: 14 }}>
            Rather talk? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
          </p>
        </form>
      )}
    </main>
  )
}
