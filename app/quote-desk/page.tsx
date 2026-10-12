import { SiteFrame } from "@/components/site/SiteFrame"
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
  .qd { background:var(--bg); color:var(--ink); min-height:100vh; font-family:var(--sans); font-size: 14px; -webkit-font-smoothing:antialiased; }
  .qd-top { display:flex; align-items:center; justify-content:space-between; padding: 14px 24px; border-bottom: 1px solid var(--line); }
  .qd-top h1 { margin:0; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
  .qd-top span { font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; border: 1px dashed var(--mut); padding: 4px 8px; }
  .qd-wrap { display:grid; grid-template-columns: 320px 1fr; gap: 24px; padding: 20px 24px 60px; align-items:start; }
  .qd-side { position: sticky; top: 72px; display:grid; gap: 14px; }
  .qd-box { background: var(--zone); border: 1px solid var(--line); padding: 14px; }
  .qd-box h2 { margin: 0 0 10px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); }
  .qd-row { display:flex; align-items:center; justify-content:space-between; gap: 8px; padding: 3px 0; }
  .qd select, .qd input[type=number] { background:var(--zone); color:var(--ink); border: 1px solid var(--line); padding: 4px 6px; font: inherit; width: 96px; min-height:44px; text-align:right; }
  .qd select { width: 150px; text-align:left; }
  .qd input[type=checkbox] { accent-color:var(--accent); width: 22px; height: 22px; }
  .qd .ov { border-color:var(--accent) !important; background: rgba(224,120,48,.14) !important; }
  .qd .rs { min-height:44px; min-width:44px; background:none; border:0; color:var(--accent); cursor:pointer; font: inherit; font-size: 12px; padding: 0 0 0 4px; }
  .qd table { width:100%; border-collapse: collapse; }
  .qd th { text-align:right; font-size: 11px; font-weight: 700; letter-spacing:.08em; text-transform: uppercase; color: var(--mut); padding: 6px 8px; border-bottom: 1px solid var(--line); }
  .qd th:first-child, .qd td:first-child { text-align:left; }
  .qd td { text-align:right; padding: 5px 8px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
  .qd td input[type=number] { width: 84px; }
  .qd tr.grp td { font-size: 11px; font-weight: 800; letter-spacing:.12em; text-transform:uppercase; color: var(--mut); padding-top: 14px; border-bottom: 0; }
  .qd .tag { font-size: 10px; font-weight: 800; letter-spacing: .08em; padding: 2px 5px; }
  .qd .tag.SAM { color:var(--green-ink); border: 1px solid rgba(159,210,159,.5); }
  .qd .tag.DRAFT { color:var(--accent); border: 1px dashed var(--accent); }
  .qd .tag.OPEN { color:var(--accent); border:1px dashed var(--accent); }
  .qd .tag.OVR { color:var(--ink); background:var(--accent); }
  .qd-tot td { border:0; padding: 3px 8px; }
  .qd-tot tr.big td { font-size: 22px; font-weight: 900; padding-top: 10px; }
  .qd-range { margin-top: 72px; padding: 12px; border: 2px solid rgba(224,120,48,.6); display:flex; justify-content:space-between; align-items:center; }
  .qd-range b { font-size: 20px; }
  .qd-note { color: var(--mut); font-size: 12px; }
  .qd-main { display:grid; gap:18px; min-width:0; }
  .qd-box { border-radius:var(--radius-sm); overflow-x:auto; }
  .qd table { min-width:520px; }
  .qd .qd-tot { min-width:0; }
  .qd-top { gap:16px; flex-wrap:wrap; }
  .qd-range { gap:12px; flex-wrap:wrap; }
  @media (max-width:800px) { .qd-wrap { grid-template-columns:minmax(0,1fr); padding:20px 16px 48px; } .qd-side { position:static; } }

`

export default async function QuoteDeskPage() {
  if (!(await deskAllowed())) notFound()
  return (
    <SiteFrame><div className="qd">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="qd-top">
        <h1>Quote desk · detailed quote</h1>
        <span>Internal · draft numbers</span>
      </header>
      <Desk vocab={vocab()} />
    </div></SiteFrame>
  )
}
