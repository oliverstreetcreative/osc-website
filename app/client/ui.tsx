// Shared building blocks for the client site. Server components; no client JS.
import Link from "next/link"
import { Check, ChevronRight, Download, ExternalLink, Play, FileText, FileSignature, Receipt, Clapperboard, Shield, Map, CalendarPlus } from "lucide-react"
import { PHASE_STEPS, phaseIndex, muxThumb, DOC_KIND_LABEL } from "@/lib/client/format"

/** The staging demo (SPEC §19): any button that would DO something shows this instead, for the demo org. */
export function DemoOff({ label, className = "", style }: { label: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`cs-btn is-off ${className}`.trim()} style={style} aria-disabled="true" role="button" title="Off in the demo">
      <span>{label}</span>
      <small>Off in the demo</small>
    </span>
  )
}

export const OSC_PHONE = "(859) 512-1419"
export const OSC_SMS = "sms:+18595121419"
export const OSC_EMAIL = "sam@oliverstreetcreative.com"

export function Wordmark() {
  return (
    <span className="cs-mark" aria-label="Oliver Street Creative">
      <b>Oliver Street</b>
      <i>Creative</i>
    </span>
  )
}

type PosterProject = {
  id: string
  name: string
  kind?: string | null
  poster_mux_id?: string | null
  poster_time?: number | null
  poster_path?: string | null
}

/** A project's poster frame: Mux still → Dropbox still → typographic poster. */
export function PosterImage({ project, orgName, logo, width = 960 }: { project: PosterProject; orgName?: string; logo?: string | null; width?: number }) {
  if (project.poster_mux_id) return <img src={muxThumb(project.poster_mux_id, project.poster_time, width)} alt="" loading="lazy" />
  if (project.poster_path) return <img src={`/client/poster/project/${project.id}`} alt="" loading="lazy" />
  return (
    <div className="cs-typo" aria-hidden>
      {logo?.startsWith("/client-logos/") ? <img className="cs-typo-logo" src={logo} alt="" /> : null}
      <b>{project.name}</b>
      {orgName && !logo ? <i>{orgName}</i> : null}
    </div>
  )
}

export function PhaseTracker({ phase }: { phase: string | null }) {
  const at = phaseIndex(phase)
  return (
    <ol className="cs-track" aria-label={`Stage: ${PHASE_STEPS[at].label}`}>
      {PHASE_STEPS.map((s, i) => (
        <li key={s.key} className={i < at ? "done" : i === at ? (i === PHASE_STEPS.length - 1 ? "now final" : "now") : ""} aria-current={i === at ? "step" : undefined}>
          <i />
          {s.label}
        </li>
      ))}
    </ol>
  )
}

export function PhasePill({ phase }: { phase: string | null }) {
  const label = PHASE_STEPS[phaseIndex(phase)].label
  const done = phase === "paid" || phase === "delivered"
  return <span className={`cs-pill ${done ? "done" : "now"}`}>{done && <Check size={12} style={{ marginRight: 4 }} />}{label}</span>
}

export function DocIcon({ kind }: { kind: string }) {
  const I =
    kind === "agreement" || kind === "release" || kind === "license" ? FileSignature
    : kind === "invoice" || kind === "receipt" ? Receipt
    : kind === "coi" || kind === "w9" ? Shield
    : kind === "call-sheet" ? Clapperboard
    : kind === "other" ? Map
    : FileText
  return (
    <span className="cs-ico" aria-hidden>
      <I />
    </span>
  )
}

export function DocRow({ doc, showProject = true }: {
  doc: { id: string; kind: string; title: string; dated_on: Date | null; signed_by?: string | null; url?: string | null; project?: { name: string } | null; description?: string | null }
  showProject?: boolean
}) {
  // A proposal opens its own page (read + accept), never the raw file (SPEC §24 v2).
  if (doc.kind === "proposal") {
    return (
      <Link className="cs-row" href={`/client/proposals/${doc.id}`}>
        <DocIcon kind={doc.kind} />
        <span className="cs-row-main">
          <strong>{doc.title}</strong>
          <small>
            {[DOC_KIND_LABEL[doc.kind], showProject && doc.project ? doc.project.name : doc.description ?? null, doc.dated_on ? doc.dated_on.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : null]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </span>
        <span className="cs-row-end" aria-hidden style={{ color: "var(--mut)" }}>
          <ChevronRight size={18} />
        </span>
      </Link>
    )
  }
  const href = doc.url ?? `/client/files/${doc.id}`
  const bits = [
    DOC_KIND_LABEL[doc.kind] ?? "File",
    showProject && doc.project ? doc.project.name : doc.description ?? null,
    doc.dated_on ? doc.dated_on.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : null,
  ].filter(Boolean)
  return (
    <a className="cs-row" href={href} target="_blank" rel="noopener">
      <DocIcon kind={doc.kind} />
      <span className="cs-row-main">
        <strong>{doc.title}</strong>
        <small>{bits.join(" · ")}</small>
      </span>
      <span className="cs-row-end" aria-hidden style={{ color: "var(--mut)" }}>
        {doc.url ? <ExternalLink size={18} /> : <Download size={18} />}
      </span>
    </a>
  )
}

export function HelpFooter() {
  return (
    <aside className="cs-help">
      <p>
        Questions? Talk to Sam.
        <small>Text or call {OSC_PHONE} · {OSC_EMAIL}</small>
      </p>
      <div className="cs-help-act">
        <a className="cs-btn light sm" href={OSC_SMS}>Text Sam</a>
        <a className="cs-btn ghost sm" href={`mailto:${OSC_EMAIL}`}>Email</a>
      </div>
    </aside>
  )
}

export function AddToCalendar({ id, google }: { id: string; google: string }) {
  return (
    <details className="cs-menu cs-cal">
      <summary className="cs-link"><CalendarPlus size={15} /> Add to calendar</summary>
      <div className="cs-pop" style={{ left: 0, right: "auto" }}>
        <a href={`/client/calendar/event/${id}`}>Apple or Outlook (.ics)</a>
        <a href={google} target="_blank" rel="noopener">Google Calendar</a>
      </div>
    </details>
  )
}

export function PlayBadge() {
  return (
    <span className="cs-play" aria-hidden>
      <Play />
    </span>
  )
}

export function SectionTitle({ children, href, link }: { children: React.ReactNode; href?: string; link?: string }) {
  return (
    <h2 className="cs-h2">
      <span>{children}</span>
      {href ? <Link href={href}>{link ?? "See all"}</Link> : null}
    </h2>
  )
}
