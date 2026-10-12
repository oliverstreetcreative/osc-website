// Pricing controls use SiteFrame tokens. Estimate formulas and release gates are unchanged.
const CSS = `
  .pe { background:var(--bg); color:var(--ink); min-height:100vh; font-family:var(--sans); -webkit-font-smoothing:antialiased; }
  .pe a { color: inherit; }
  .pe-draft { font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; color: var(--mut); border: 1px dashed var(--mut); padding: 5px 9px; }
  .pe-main { max-width: 760px; margin: 0 auto; padding: 48px 16px 64px; }
  .pe-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--mut); margin-bottom: 14px; text-align:center; }
  .pe-h1 { font-size: clamp(40px, 8vw, 84px); font-weight: 800; line-height: 1; letter-spacing: -.035em; margin: 0; text-align:center; }
  .pe-lede { font-size: clamp(18px, 2.2vw, 22px); line-height: 1.4; color: var(--mut); margin: 18px auto 34px; text-align:center; max-width: 34ch; }
  .pe-card { border-radius:var(--radius); background: var(--zone); border: 1px solid var(--line); padding: 22px 18px; }
  .pe-q { display:block; border:0; margin: 0 0 26px; padding:0; min-width:0; }
  .pe-q legend, .pe-qh { display:flex; justify-content:space-between; font-size: 17px; font-weight: 700; margin-bottom: 12px; padding:0; }
  .pe-q legend { width:100%; }
  .pe-qh b { color:var(--accent); font-size: 22px; }
  .pe-sub { display:block; font-size: 14px; color: var(--mut); margin-top: 6px; }
  .pe-scale { display:flex; justify-content:space-between; font-size: 12px; color: var(--mut); font-style: normal; }
  .pe-scale i { font-style: normal; }
  .pe-levels { display:grid; gap: 10px; }
  .pe-level { border-radius:var(--radius-sm); text-align:left; background: transparent; color: inherit; border: 2px solid var(--rule-strong); padding: 12px 14px; cursor:pointer; font: inherit; }
  .pe-level b { display:block; font-size: 17px; }
  .pe-level span { display:block; font-size: 14px; color: var(--mut); margin-top: 2px; }
  .pe-level.on { border-color: var(--accent); background: rgba(224,120,48,.1); }
  .pe input[type=range] { width: 100%; accent-color: var(--accent); height: 28px; }
  .pe-check { min-height:44px; display:flex; gap: 10px; align-items:center; font-size: 16px; padding: 6px 0; }
  .pe input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--accent); flex: none; }
  .pe-checks { display:grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .pe-seg { display:grid; grid-template-columns: repeat(3, 1fr); border: 2px solid var(--rule-strong); }
  .pe-seg button { background: transparent; color: inherit; border: 0; padding: 12px 6px; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; }
  .pe-seg button + button { border-left: 2px solid var(--rule-strong); }
  .pe-seg button.on { background: rgba(224,120,48,.18); color: var(--ink); box-shadow: inset 0 -3px 0 var(--accent); }
  .pe-more { min-height:44px; background: transparent; border: 0; color: var(--accent); font: inherit; font-size: 15px; font-weight: 700; padding: 0; margin: 0 0 24px; cursor: pointer; text-align: left; }
  .pe-step { display:inline-flex; align-items:center; gap: 14px; }
  .pe-step button { width: 44px; height: 44px; border: 2px solid var(--rule-strong); background: transparent; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; }
  .pe-step b { color:var(--accent); font-size: 22px; min-width: 1ch; text-align:center; }
  .pe-flex { display:flex; gap: 12px; align-items:flex-start; border: 2px dashed rgba(224,120,48,.6); padding: 14px; margin-bottom: 24px; }
  .pe-flex > span > b { display:block; font-size: 17px; }
  .pe-flex > span > span { display:block; font-size: 14px; color: var(--mut); margin-top: 3px; }
  .pe-drafttag { display:inline-block; margin-top: 4px; font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color:var(--accent); }
  .pe-result { text-align:center; border-top: 1px solid var(--line); padding-top: 22px; }
  .pe-say { margin:0; font-size: 16px; color: var(--mut); }
  .pe-num { margin: 6px 0 0; font-family:var(--wordmark); font-size: clamp(32px, 8vw, 64px); font-weight: 900; letter-spacing: -.04em; line-height:1.05; overflow-wrap:anywhere; }
  .pe-dash { color: var(--mut); margin: 0 .08em; }
  .pe-save { margin: 10px 0 0; font-size: 15px; color:var(--accent); font-weight: 700; }
  .pe-save.dim { color: var(--mut); font-weight: 500; }
  .pe-ctas { margin-top: 22px; }
  .pe-cta { display:block; padding: 16px 20px; background:var(--ink); color:var(--on-strong) !important; font-weight: 800; letter-spacing:.06em; text-transform: uppercase; font-size: 14px; text-decoration:none; }
  .pe-cta.ghost { background: transparent; color:var(--ink) !important; border: 2px solid var(--mut); margin-top: 10px; }
  .pe-fine { font-size: 13px; color: var(--mut); text-align:center; margin: 20px auto 0; max-width: 46ch; }
  .pe-links { text-align:center; margin-top: 18px; font-size: 13px; }
  .pe-links a { color:var(--accent); }
  .pe .pe-draft { display:block; color:var(--mut); border-color:var(--rule-strong); margin:0 auto 24px; width:fit-content; text-align:center; }
  .pe .pe-sub { margin-top:8px; }
  .pe .pe-fine { margin:20px auto 0; }
  .pe .pe-lede { margin:18px auto 34px; }
  .pe .pe-num { margin:6px 0 0; }
  @media (max-width: 380px) { .pe-checks { grid-template-columns:1fr; } .pe-seg { grid-template-columns:1fr; } .pe-seg button + button { border-left:0; border-top:1px solid var(--line); } }
  @media (min-width: 720px) { .pe-card { padding: 32px; } .pe-levels { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 720px) {  }
`

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </>
  )
}
