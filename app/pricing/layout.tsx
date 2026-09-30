// Styles for /pricing, in the same dark look as /service-businesses.
const CSS = `
  .pe { background:#141412; color:#F7F6F3; min-height:100vh; font-family: var(--font-inter), Inter, -apple-system, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .pe a { color: inherit; }
  .pe-top { position: sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between; padding: 14px 20px; background: rgba(20,20,18,.82); backdrop-filter: saturate(160%) blur(14px); -webkit-backdrop-filter: saturate(160%) blur(14px); }
  .pe-top img { height: 34px; width:auto; display:block; }
  .pe-draft { font-size: 11px; font-weight: 700; letter-spacing:.12em; text-transform:uppercase; color: rgba(247,246,243,.85); border: 1px dashed rgba(247,246,243,.55); padding: 5px 9px; }
  .pe-main { max-width: 680px; margin: 0 auto; padding: 48px 16px 40px; }
  .pe-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(247,246,243,.5); margin-bottom: 14px; text-align:center; }
  .pe-h1 { font-size: clamp(40px, 8vw, 84px); font-weight: 800; line-height: 1; letter-spacing: -.035em; margin: 0; text-align:center; }
  .pe-lede { font-size: clamp(18px, 2.2vw, 22px); line-height: 1.4; color: rgba(247,246,243,.72); margin: 18px auto 34px; text-align:center; max-width: 34ch; }
  .pe-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); padding: 22px 18px; }
  .pe-q { display:block; border:0; margin: 0 0 26px; padding:0; min-width:0; }
  .pe-q legend, .pe-qh { display:flex; justify-content:space-between; font-size: 17px; font-weight: 700; margin-bottom: 12px; padding:0; }
  .pe-q legend { width:100%; }
  .pe-qh b { color:#E07830; font-size: 22px; }
  .pe-sub { display:block; font-size: 14px; color: rgba(247,246,243,.55); margin-top: 6px; }
  .pe-scale { display:flex; justify-content:space-between; font-size: 12px; color: rgba(247,246,243,.4); font-style: normal; }
  .pe-scale i { font-style: normal; }
  .pe-levels { display:grid; gap: 10px; }
  .pe-level { text-align:left; background: transparent; color: inherit; border: 2px solid rgba(247,246,243,.2); padding: 12px 14px; cursor:pointer; font: inherit; }
  .pe-level b { display:block; font-size: 17px; }
  .pe-level span { display:block; font-size: 14px; color: rgba(247,246,243,.6); margin-top: 2px; }
  .pe-level.on { border-color: #E07830; background: rgba(224,120,48,.1); }
  .pe input[type=range] { width: 100%; accent-color: #E07830; height: 28px; }
  .pe-check { display:flex; gap: 10px; align-items:center; font-size: 16px; padding: 6px 0; }
  .pe input[type=checkbox] { width: 22px; height: 22px; accent-color: #E07830; flex: none; }
  .pe-flex { display:flex; gap: 12px; align-items:flex-start; border: 2px dashed rgba(224,120,48,.6); padding: 14px; margin-bottom: 24px; }
  .pe-flex > span > b { display:block; font-size: 17px; }
  .pe-flex > span > span { display:block; font-size: 14px; color: rgba(247,246,243,.65); margin-top: 3px; }
  .pe-drafttag { display:inline-block; margin-top: 8px; font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color:#E07830; }
  .pe-result { text-align:center; border-top: 1px solid rgba(255,255,255,.12); padding-top: 22px; }
  .pe-say { margin:0; font-size: 16px; color: rgba(247,246,243,.65); }
  .pe-num { margin: 6px 0 0; font-size: clamp(38px, 10vw, 64px); font-weight: 900; letter-spacing: -.04em; line-height:1.05; }
  .pe-dash { color: rgba(247,246,243,.45); margin: 0 .08em; }
  .pe-save { margin: 10px 0 0; font-size: 15px; color:#E07830; font-weight: 700; }
  .pe-save.dim { color: rgba(247,246,243,.55); font-weight: 500; }
  .pe-ctas { margin-top: 22px; }
  .pe-cta { display:block; padding: 16px 20px; background:#E07830; color:#141412 !important; font-weight: 800; letter-spacing:.06em; text-transform: uppercase; font-size: 14px; text-decoration:none; }
  .pe-cta.ghost { background: transparent; color:#F7F6F3 !important; border: 2px solid rgba(247,246,243,.5); margin-top: 10px; }
  .pe-fine { font-size: 13px; color: rgba(247,246,243,.45); text-align:center; margin: 20px auto 0; max-width: 46ch; }
  .pe-links { text-align:center; margin-top: 18px; font-size: 13px; }
  .pe-links a { color:#E07830; }
  .pe-foot { padding: 40px 20px 60px; text-align:center; font-size: 13px; color: rgba(247,246,243,.45); border-top: 1px solid rgba(255,255,255,.1); }
  .pe-foot a { margin: 0 10px; text-decoration:none; color: rgba(247,246,243,.7); }
  @media (min-width: 720px) { .pe-card { padding: 32px; } .pe-levels { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 720px) { .wide-only { display:none; } .pe-top { padding: 12px 16px; } }
`

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </>
  )
}
