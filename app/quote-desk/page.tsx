import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { deskAllowed } from "@/lib/estimator/desk-auth"
import { vocab } from "@/lib/estimator/vocab"
import Desk from "./desk"

// ---------------------------------------------------------------------------
// /quote-desk - the DETAILED quote (internal, Sam 10/2). Same engine as the
// public /pricing range. Walks the full question set, shows every line's cost,
// markup and charge, and lets us override ANY value; overrides win and are
// marked. Shows the range the client would see for the same answers.
// Gate: lib/estimator/desk-auth.ts (staging + staff session or desk key; never
// production; open under local `next dev`). Not in middleware PUBLIC_PATHS on
// purpose: the page checks for itself and 404s.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Quote desk | Oliver Street Creative",
  robots: { index: false, follow: false },
}

const CSS = `
  .qd { background:#141412; color:#F7F6F3; min-height:100vh; font-family: var(--font-inter), Inter, -apple-system, system-ui, sans-serif; font-size: 14px; -webkit-font-smoothing:antialiased; }
  .qd-top { display:flex; align-items:center; justify-content:space-between; padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .qd-top h1 { margin:0; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
  .qd-top span { font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; border: 1px dashed rgba(247,246,243,.55); padding: 4px 8px; }
  .qd-wrap { display:grid; grid-template-columns: 320px 1fr; gap: 24px; padding: 20px 24px 60px; align-items:start; }
  .qd-side { position: sticky; top: 12px; display:grid; gap: 14px; }
  .qd-box { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); padding: 14px; }
  .qd-box h2 { margin: 0 0 10px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgba(247,246,243,.55); }
  .qd-row { display:flex; align-items:center; justify-content:space-between; gap: 8px; padding: 3px 0; }
  .qd select, .qd input[type=number] { background:#0b0b0a; color:#F7F6F3; border: 1px solid rgba(255,255,255,.18); padding: 4px 6px; font: inherit; width: 96px; text-align:right; }
  .qd select { width: 150px; text-align:left; }
  .qd input[type=checkbox] { accent-color:#E07830; width: 16px; height: 16px; }
  .qd .ov { border-color:#E07830 !important; background: rgba(224,120,48,.14) !important; }
  .qd .rs { background:none; border:0; color:#E07830; cursor:pointer; font: inherit; font-size: 12px; padding: 0 0 0 4px; }
  .qd table { width:100%; border-collapse: collapse; }
  .qd th { text-align:right; font-size: 11px; font-weight: 700; letter-spacing:.08em; text-transform: uppercase; color: rgba(247,246,243,.5); padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.14); }
  .qd th:first-child, .qd td:first-child { text-align:left; }
  .qd td { text-align:right; padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,.06); font-variant-numeric: tabular-nums; }
  .qd td input[type=number] { width: 84px; }
  .qd tr.grp td { font-size: 11px; font-weight: 800; letter-spacing:.12em; text-transform:uppercase; color: rgba(247,246,243,.45); padding-top: 14px; border-bottom: 0; }
  .qd .tag { font-size: 10px; font-weight: 800; letter-spacing: .08em; padding: 2px 5px; }
  .qd .tag.SAM { color:#9fd29f; border: 1px solid rgba(159,210,159,.5); }
  .qd .tag.DRAFT { color:#E07830; border: 1px dashed #E07830; }
  .qd .tag.OPEN { color:#f0c060; border: 1px dashed #f0c060; }
  .qd .tag.OVR { color:#141412; background:#E07830; }
  .qd-tot td { border:0; padding: 3px 8px; }
  .qd-tot tr.big td { font-size: 22px; font-weight: 900; padding-top: 10px; }
  .qd-range { margin-top: 12px; padding: 12px; border: 2px solid rgba(224,120,48,.6); display:flex; justify-content:space-between; align-items:center; }
  .qd-range b { font-size: 20px; }
  .qd-note { color: rgba(247,246,243,.5); font-size: 12px; }
  .qd-main { display:grid; gap: 18px; }
`

export default async function QuoteDeskPage() {
  if (!(await deskAllowed())) notFound()
  return (
    <div className="qd">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="qd-top">
        <h1>Quote desk · detailed quote</h1>
        <span>Internal · draft numbers</span>
      </header>
      <Desk vocab={vocab()} />
    </div>
  )
}
