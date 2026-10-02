"use client"

import { useEffect, useRef, useState } from "react"
import type { Vocab } from "@/lib/estimator/vocab"
import type { Quote, Spec, Edits, Line } from "@/lib/estimator/engine"

// The DETAILED quote. Starts from a Simple answer set, drills down. Every value
// is an input: change it and it becomes an override (orange, with a reset).
// All math happens on the server (/api/quote-desk); this only displays.

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US")
const PCT_PARAMS = new Set(["markup", "contingency", "flexibleDiscount", "rushPremium", "rangeLow", "rangeHigh"])
const NUM_SPEC: (keyof Spec)[] = ["prepDays", "shootDays", "pickupDays", "editDays", "extraVideos", "travel"]
const BOOL_SPEC: (keyof Spec)[] = ["assistant", "secondHand", "rentals"]
const SPEC_LABEL: Record<keyof Spec, string> = {
  prepDays: "Prep days", shootDays: "Shoot days", pickupDays: "Pickup days", editDays: "Edit/finishing days",
  extraVideos: "Extra finished videos", assistant: "Assistant", secondHand: "Second hand (DP/gaffer)",
  rentals: "Extra rentals", travel: "Travel $ (at cost)",
}

function Num({ value, onChange, over, step = 1, pct = false }: { value: number; onChange: (n: number) => void; over?: boolean; step?: number; pct?: boolean }) {
  const shown = pct ? +(value * 100).toFixed(2) : +value.toFixed(2)
  const [txt, setTxt] = useState(String(shown))
  useEffect(() => setTxt(String(shown)), [shown])
  return (
    <input
      type="number"
      step={step}
      className={over ? "ov" : ""}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(pct ? n / 100 : n)
      }}
    />
  )
}

export default function Desk({ vocab }: { vocab: Vocab }) {
  const [kind, setKind] = useState(vocab.kinds[0].id)
  const [quality, setQuality] = useState(vocab.qualities[0].id)
  const [deadline, setDeadline] = useState("firm")
  const [handles, setHandles] = useState<string[]>(vocab.handles.filter((h) => h.defaultOn).map((h) => h.id))
  const [edits, setEdits] = useState<Required<Edits>>({ spec: {}, params: {}, lines: {} })
  const [q, setQ] = useState<Quote | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const t = setTimeout(async () => {
      const r = await fetch("/api/quote-desk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { kind, quality, deadline, handles }, edits }),
      })
      if (r.ok && id === seq.current) setQ(await r.json())
    }, 120)
    return () => clearTimeout(t)
  }, [kind, quality, deadline, handles, edits])

  const setSpec = (k: keyof Spec, v: number | boolean) => setEdits((e) => ({ ...e, spec: { ...e.spec, [k]: v } }))
  const resetSpec = (k: keyof Spec) => setEdits((e) => { const s = { ...e.spec }; delete s[k]; return { ...e, spec: s } })
  const setParam = (k: string, v: number) => setEdits((e) => ({ ...e, params: { ...e.params, [k]: v } }))
  const resetParam = (k: string) => setEdits((e) => { const p: Record<string, number> = { ...e.params }; delete p[k]; return { ...e, params: p } })
  const setLine = (id: string, f: "qty" | "unitCost" | "markup", v: number) =>
    setEdits((e) => ({ ...e, lines: { ...e.lines, [id]: { ...(e.lines[id] ?? {}), [f]: v } } }))
  const resetLine = (id: string) => setEdits((e) => { const l = { ...e.lines }; delete l[id]; return { ...e, lines: l } })
  const resetAll = () => setEdits({ spec: {}, params: {}, lines: {} })
  const toggle = (id: string) => setHandles((hs) => (hs.includes(id) ? hs.filter((h) => h !== id) : [...hs, id]))

  const groups = q ? Array.from(new Set(q.lines.map((l) => l.group))) : []
  const nOver = q ? q.specOverridden.length + q.params.filter((p) => p.overridden).length + q.lines.filter((l) => l.overridden.length).length : 0

  return (
    <div className="qd-wrap">
      <aside className="qd-side">
        <div className="qd-box">
          <h2>Simple answers (what the client sees)</h2>
          <div className="qd-row"><span>Kind of video</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>{vocab.kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
          <div className="qd-row"><span>Quality</span>
            <select value={quality} onChange={(e) => setQuality(e.target.value)}>{vocab.qualities.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
          <div className="qd-row"><span>Deadline</span>
            <select value={deadline} onChange={(e) => setDeadline(e.target.value)}>{vocab.deadlines.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
          <div style={{ marginTop: 8 }} className="qd-note">Oliver Street handles…</div>
          {vocab.handles.map((h) => (
            <label key={h.id} className="qd-row" style={{ justifyContent: "flex-start" }}>
              <input type="checkbox" checked={handles.includes(h.id)} onChange={() => toggle(h.id)} /> {h.label}
            </label>
          ))}
        </div>
        {q && (
          <div className="qd-box">
            <h2>Days, crew, travel</h2>
            {NUM_SPEC.map((k) => (
              <div key={k} className="qd-row">
                <span>{SPEC_LABEL[k]}{q.specOverridden.includes(k) && <button className="rs" onClick={() => resetSpec(k)}>reset</button>}</span>
                <Num value={q.spec[k] as number} step={k === "travel" ? 50 : 0.5} over={q.specOverridden.includes(k)} onChange={(n) => setSpec(k, n)} />
              </div>
            ))}
            {BOOL_SPEC.map((k) => (
              <label key={k} className="qd-row">
                <span>{SPEC_LABEL[k]}{q.specOverridden.includes(k) && <button className="rs" onClick={(e) => { e.preventDefault(); resetSpec(k) }}>reset</button>}</span>
                <input type="checkbox" className={q.specOverridden.includes(k) ? "ov" : ""} checked={q.spec[k] as boolean} onChange={(e) => setSpec(k, e.target.checked)} />
              </label>
            ))}
          </div>
        )}
        {nOver > 0 && <button className="rs" style={{ textAlign: "left" }} onClick={resetAll}>Reset all {nOver} overrides</button>}
      </aside>

      {q && (
        <div className="qd-main">
          <div className="qd-box">
            <h2>Line items</h2>
            <table>
              <thead><tr><th>Line</th><th>Qty</th><th>Unit cost</th><th>Markup %</th><th>Unit charge</th><th>Cost</th><th>Charge</th><th></th></tr></thead>
              <tbody>
                {groups.map((g) => [
                  <tr key={g} className="grp"><td colSpan={8}>{g}</td></tr>,
                  ...q.lines.filter((l) => l.group === g).map((l: Line) => (
                    <tr key={l.id}>
                      <td>{l.label}{l.overridden.length > 0 && <button className="rs" onClick={() => resetLine(l.id)}>reset</button>}</td>
                      <td><Num value={l.qty} step={0.5} over={l.overridden.includes("qty")} onChange={(n) => setLine(l.id, "qty", n)} /></td>
                      <td><Num value={l.unitCost} step={50} over={l.overridden.includes("unitCost")} onChange={(n) => setLine(l.id, "unitCost", n)} /></td>
                      <td><Num value={l.markup} pct over={l.overridden.includes("markup")} onChange={(n) => setLine(l.id, "markup", n)} /></td>
                      <td>{money(l.unitCharge)}</td>
                      <td>{money(l.cost)}</td>
                      <td>{money(l.charge)}</td>
                      <td><span className={"tag " + (l.overridden.length ? "OVR" : l.tag)}>{l.overridden.length ? "OVERRIDE" : l.tag}</span></td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
            <table className="qd-tot" style={{ marginTop: 12, maxWidth: 420, marginLeft: "auto" }}>
              <tbody>
                <tr><td>Subtotal</td><td>{money(q.subtotal)}</td></tr>
                <tr><td>Insurance/contingency</td><td>{money(q.contingency)}</td></tr>
                {q.deadlineAdj !== 0 && <tr><td>{q.deadlineAdj < 0 ? "Flexible dates" : "Rush"}</td><td>{q.deadlineAdj < 0 ? "−" : "+"}{money(Math.abs(q.deadlineAdj))}</td></tr>}
                {q.travel > 0 && <tr><td>Travel (at cost)</td><td>{money(q.travel)}</td></tr>}
                <tr><td>Before rounding</td><td>{money(q.beforeFloor)}</td></tr>
                {q.floorApplied && <tr><td colSpan={2} className="qd-note">Raised to the $3,999 finished-video floor</td></tr>}
                <tr className="big"><td>Quote</td><td>{money(q.total)}</td></tr>
              </tbody>
            </table>
            <div className="qd-range">
              <span>The client&rsquo;s Simple quote shows</span>
              <b>{money(q.range.low)} – {money(q.range.high)}</b>
            </div>
          </div>

          <div className="qd-box">
            <h2>Every number the formula uses</h2>
            <table>
              <thead><tr><th>Parameter</th><th>Value</th><th>Default</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {q.params.map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}{p.overridden && <button className="rs" onClick={() => resetParam(p.key)}>reset</button>}</td>
                    <td><Num value={p.value} pct={PCT_PARAMS.has(p.key)} step={PCT_PARAMS.has(p.key) ? 1 : 50} over={p.overridden} onChange={(n) => setParam(p.key, n)} /></td>
                    <td>{PCT_PARAMS.has(p.key) ? `${+(p.default * 100).toFixed(2)}%` : p.default.toLocaleString("en-US")}</td>
                    <td style={{ textAlign: "left" }} className="qd-note">{p.note}</td>
                    <td><span className={"tag " + (p.overridden ? "OVR" : p.tag)}>{p.overridden ? "OVERRIDE" : p.tag}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="qd-note">SAM = you ruled it. DRAFT = a placeholder for you to rule. OPEN = yours to decide. The kind-of-video and quality tables (days, crew, edit time per choice) are DRAFT too.</p>
          </div>
        </div>
      )}
    </div>
  )
}
