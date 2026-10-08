// Start a project's cards (SPEC §17; §31 v2): the start card in its three words, the brand-new client's one primary
// card, and a sent request shown as a project in Quote (a card on the classic Home and Projects, a row on the
// one-glance Home). Requests are the org's: every member sees the card; money stays on the request page, for those who
// see money.
import Link from "next/link"
import { Plus, ArrowRight, MessageSquare, ChevronRight } from "lucide-react"
import type { ClientContext } from "@/lib/client/context"
import { canRequest, kindLabel, sentAt, timingLabel } from "@/lib/client/requests"
import { requestTitle, stepNumber, STEPS, isStep, type Answers } from "@/lib/client/request-form"
import { dayET } from "@/lib/client/format"
import { OSC_PHONE, OSC_SMS, PhasePill } from "@/app/client/ui"

export type Req = {
  id: string
  kind: string | null
  like_project: string | null
  timing: string | null
  due_on: Date | null
  status: string
  form_version: number
  answers: unknown
  sent_at: Date | null
  created_at: Date
}
type Draft = { id: string; step: string | null; updated_at: Date }

/** A request's name: the pitch's first sentence (v3), or the one-page request's kind and timing (v4). */
export function requestName(r: Req): string {
  if (r.form_version >= 5) return requestTitle((r.answers ?? {}) as Answers)
  return [kindLabel(r.kind, r.like_project), timingLabel(r.timing, r.due_on)].filter(Boolean).join(" · ")
}

/** Its plain status line, and whether to offer "Text Sam" (three days on with no proposal). */
export function requestStatus(r: Req, now = Date.now()): { line: string; nudge: boolean } {
  const when = dayET(sentAt(r))
  const line = r.status === "in_review" ? "Sam has your request and is working on a proposal." : `Sent to Sam on ${when}. He'll be in touch.`
  return { line, nudge: sentAt(r).getTime() < now - 3 * 86_400_000 }
}

/** A sent request as a project in Quote (classic Home and Projects): a typographic poster, the Quote pill, the line. */
export function RequestCard({ r, orgName, logo }: { r: Req; orgName: string; logo?: string | null }) {
  const name = requestName(r)
  const { line, nudge } = requestStatus(r)
  return (
    <div className="cs-card cs-pcard cs-req">
      <Link href={`/client/requests/${r.id}`} className="cs-req-link">
        <div className="cs-poster">
          <div className="cs-typo" aria-hidden>
            {logo?.startsWith("/client-logos/") ? <img className="cs-typo-logo" src={logo} alt="" /> : null}
            <b>{name}</b>
            {orgName && !logo ? <i>{orgName}</i> : null}
          </div>
          <span className="cs-poster-tag">New project</span>
        </div>
        <div className="cs-pcard-body">
          <h3>{name}</h3>
          <div className="cs-pcard-meta">
            <PhasePill phase="quote" />
          </div>
          <p className="cs-req-line">{line}</p>
        </div>
      </Link>
      {nudge ? (
        <p className="cs-req-nudge cs-req-nudge-card">
          Haven&rsquo;t heard back? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </p>
      ) : null}
    </div>
  )
}

/** The same request as a row (the one-glance Home's jobs, and old one-page requests anywhere). */
export function RequestRow({ r }: { r: Req }) {
  const { line, nudge } = requestStatus(r)
  return (
    <div className="cs-row cs-job cs-req-row">
      <Link href={`/client/requests/${r.id}`} className="cs-req-row-link">
        <span className="cs-row-main">
          <strong>
            {requestName(r)} <PhasePill phase="quote" />
          </strong>
          <small>
            <b>Now</b> · {line}
          </small>
        </span>
        <ChevronRight size={18} color="var(--mut)" aria-hidden />
      </Link>
      {/* Outside the row's link: a link can't hold another link. */}
      {nudge ? (
        <small className="cs-req-nudge">
          Haven&rsquo;t heard back? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </small>
      ) : null}
    </div>
  )
}

/** The org's open requests on Projects: v3 requests as Quote cards, one-page ones as rows. */
export function RequestList({ requests, orgName, logo }: { requests: Req[]; orgName: string; logo?: string | null }) {
  if (!requests.length) return null
  const cards = requests.filter((r) => r.form_version >= 5)
  const rows = requests.filter((r) => r.form_version < 5)
  return (
    <>
      {cards.length ? (
        <section className="cs-section" style={{ marginTop: 20 }}>
          <div className="cs-grid">{cards.map((r) => <RequestCard key={r.id} r={r} orgName={orgName} logo={logo} />)}</div>
        </section>
      ) : null}
      {rows.length ? (
        <section className="cs-section" style={{ marginTop: 20 }}>
          <div className="cs-rows">{rows.map((r) => <RequestRow key={r.id} r={r} />)}</div>
        </section>
      ) : null}
    </>
  )
}

const draftWhere = (d: Draft) => (d.step && isStep(d.step) ? `Step ${stepNumber(d.step)} of ${STEPS.length}` : "Ready to review")

/**
 * A brand-new client's ONE primary card (SPEC §31 v2): "Start a project", or "Finish your project request" when a draft
 * is waiting. Filled: it's the page's only action.
 */
export function StartHero({ ctx, draft }: { ctx: ClientContext; draft: Draft | null }) {
  const may = canRequest(ctx) || !!ctx.viewing
  if (!may) {
    return (
      <section className="cs-section">
        <a href={OSC_SMS} className="cs-card cs-row" style={{ borderRadius: 16 }}>
          <span className="cs-ico"><MessageSquare /></span>
          <span className="cs-row-main">
            <strong>Want a video?</strong>
            <small>Text Sam · {OSC_PHONE}</small>
          </span>
        </a>
      </section>
    )
  }
  return (
    <section className="cs-section">
      <div className="cs-card cs-hero-start">
        <p className="cs-eyebrow">{draft ? "Your project request" : "Let's make something"}</p>
        <h2>{draft ? "Finish your project request" : "Start a project"}</h2>
        <p className="cs-hero-start-line">
          {draft
            ? `${draftWhere(draft)} · saved ${dayET(draft.updated_at)}. Pick up where you left off.`
            : "Tell us what you're making. It takes about ten minutes, and it saves as you go."}
        </p>
        <Link className="cs-btn" href="/client/start">
          {draft ? "Pick up where you left off" : "Start a project"}
        </Link>
        <p className="cs-hero-start-alt">
          Rather talk? <a className="cs-link" href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </p>
      </div>
    </section>
  )
}

/** The quiet card at the bottom of Home and Projects (never above Needs you): "Start a project", "Start another
 *  project" once there is a first, or "Finish your project request" while a draft waits. */
export function StartCard({ ctx, hasProjects = true, draft = null }: { ctx: ClientContext; hasProjects?: boolean; draft?: Draft | null }) {
  // Staff viewing see the client's card; the screens themselves are look-only for them.
  if (canRequest(ctx) || ctx.viewing) {
    const title = draft ? "Finish your project request" : hasProjects ? "Start another project" : "Start a project"
    const sub = draft ? `${draftWhere(draft)} · saved ${dayET(draft.updated_at)}` : "Tell Sam what you have in mind"
    return (
      <section className="cs-section">
        <Link href="/client/start" className="cs-card cs-row" style={{ borderRadius: 16 }}>
          <span className="cs-ico"><Plus /></span>
          <span className="cs-row-main">
            <strong>{title}</strong>
            <small>{sub}</small>
          </span>
          <ArrowRight size={18} color="var(--mut)" />
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

