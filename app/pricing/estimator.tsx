"use client"

import { useEffect, useRef, useState } from "react"
import type { Vocab } from "@/lib/estimator/vocab"

// The SIMPLE quote's controls. Holds NO prices: every change posts the answers
// to /api/estimate and shows the range that comes back.

type Range = { low: number; high: number }
const money = (n: number) => "$" + n.toLocaleString("en-US")

export default function Estimator({ vocab }: { vocab: Vocab }) {
  const [kind, setKind] = useState(vocab.kinds[0].id)
  const [quality, setQuality] = useState(vocab.qualities[0].id)
  const [deadline, setDeadline] = useState("firm")
  const [handles, setHandles] = useState<string[]>(vocab.handles.filter((h) => h.defaultOn).map((h) => h.id))
  const [showDays, setShowDays] = useState(false)
  const [shootDays, setShootDays] = useState(vocab.kinds[0].shootDays)
  const [daysTouched, setDaysTouched] = useState(false)
  const [pickupDays, setPickupDays] = useState(0)
  const [range, setRange] = useState<Range | null>(null)
  const seq = useRef(0)

  // The day count is pre-filled from the kind of video until someone moves it.
  useEffect(() => {
    if (!daysTouched) setShootDays(vocab.kinds.find((k) => k.id === kind)?.shootDays ?? 1)
  }, [kind, daysTouched, vocab.kinds])

  useEffect(() => {
    const id = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind, quality, deadline, handles,
            shootDays: showDays && daysTouched ? shootDays : undefined,
            pickupDays: showDays ? pickupDays : undefined,
          }),
        })
        const j = await r.json()
        if (id === seq.current && r.ok) setRange(j)
      } catch {
        /* keep the last range */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [kind, quality, deadline, handles, shootDays, pickupDays, showDays, daysTouched])

  const toggle = (id: string) => setHandles((hs) => (hs.includes(id) ? hs.filter((h) => h !== id) : [...hs, id]))

  return (
    <div className="pe-card">
      <fieldset className="pe-q">
        <legend>What kind of video?</legend>
        <div className="pe-levels">
          {vocab.kinds.map((k) => (
            <button key={k.id} type="button" className={"pe-level" + (kind === k.id ? " on" : "")} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              <b>{k.label}</b>
              <span>{k.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pe-q">
        <legend>How should it look?</legend>
        <div className="pe-levels">
          {vocab.qualities.map((q) => (
            <button key={q.id} type="button" className={"pe-level" + (quality === q.id ? " on" : "")} aria-pressed={quality === q.id} onClick={() => setQuality(q.id)}>
              <b>{q.label}</b>
              <span>{q.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pe-q">
        <legend>How strict is your deadline?</legend>
        <div className="pe-seg" role="radiogroup">
          {vocab.deadlines.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={deadline === d.id} className={deadline === d.id ? "on" : ""} onClick={() => setDeadline(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <span className="pe-sub">
          {vocab.deadlines.find((d) => d.id === deadline)?.note}
          {deadline === "flexible" && <em className="pe-drafttag"> DRAFT % · amount not set yet</em>}
        </span>
      </fieldset>

      <fieldset className="pe-q">
        <legend>Oliver Street handles&hellip;</legend>
        <div className="pe-checks">
          {vocab.handles.map((h) => (
            <label key={h.id} className="pe-check">
              <input type="checkbox" checked={handles.includes(h.id)} onChange={() => toggle(h.id)} />
              <span>{h.label}</span>
            </label>
          ))}
        </div>
        <span className="pe-sub">Leave a box empty if you&rsquo;ll bring that yourself.</span>
      </fieldset>

      {!showDays ? (
        <button type="button" className="pe-more" onClick={() => setShowDays(true)}>
          Know how many days you need? Adjust them &rsaquo;
        </button>
      ) : (
        <div className="pe-q">
          <label className="pe-q" style={{ marginBottom: 18 }}>
            <span className="pe-qh">
              Shoot days <b>{shootDays}</b>
            </span>
            <input type="range" min={1} max={5} step={1} value={shootDays} onChange={(e) => { setDaysTouched(true); setShootDays(+e.target.value) }} />
          </label>
          <div className="pe-qh">
            <span>Pickup days</span>
            <span className="pe-step">
              <button type="button" aria-label="Fewer pickup days" onClick={() => setPickupDays((n) => Math.max(0, n - 1))}>&minus;</button>
              <b>{pickupDays}</b>
              <button type="button" aria-label="More pickup days" onClick={() => setPickupDays((n) => Math.min(3, n + 1))}>+</button>
            </span>
          </div>
          <span className="pe-sub">A short extra day later, with just a camera or a drone.</span>
        </div>
      )}

      <div className="pe-result" aria-live="polite">
        <p className="pe-say">Projects like this usually land between</p>
        <p className="pe-num">
          {range ? (
            <>
              {money(range.low)}<span className="pe-dash">&ndash;</span>{money(range.high)}
            </>
          ) : (
            "…"
          )}
        </p>
        <div className="pe-ctas">
          <a className="pe-cta" href="sms:+18595121419">Text Sam · (859) 512-1419</a>
          <a className="pe-cta ghost" href="https://cal.com/oliverstreetcreative" target="_blank" rel="noopener noreferrer">
            Book 20 minutes
          </a>
        </div>
      </div>
    </div>
  )
}
