export const CSS = `
.sg { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: #141412; color: #f7f6f3; font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.sg-card { width: 100%; max-width: 360px; display: grid; gap: 14px; }
.sg-brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(247, 246, 243, 0.66); }
.sg-h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.sg-sub { color: rgba(247, 246, 243, 0.66); font-size: 15px; line-height: 1.45; }
.sg-note { background: rgba(224, 120, 48, 0.14); border: 1px solid rgba(224, 120, 48, 0.4); border-radius: 10px; padding: 12px 14px; font-size: 15px; line-height: 1.45; }
.sg-label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: rgba(247, 246, 243, 0.8); }
.sg-input { height: 48px; border-radius: 10px; border: 1px solid rgba(247, 246, 243, 0.22); background: #1f1f1c; color: #f7f6f3; padding: 0 14px; font: inherit; font-size: 16px; }
.sg-input[readonly] { color: rgba(247, 246, 243, 0.66); }
.sg-input:focus { outline: 2px solid #e07830; outline-offset: 1px; border-color: transparent; }
.sg-wrong { color: #ffb4a8; font-size: 15px; }
.sg-btn { height: 50px; border: 0; border-radius: 999px; background: #e07830; color: #141412; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 4px; }
.sg-btn:focus-visible { outline: 2px solid #f7f6f3; outline-offset: 2px; }
`

export function GateShell({ children }: { children: React.ReactNode }) {
  return <main className="sg" data-staging-gate=""><style>{CSS}</style><div className="sg-card">
    <p className="sg-brand">Oliver Street Creative</p>{children}
  </div></main>
}
