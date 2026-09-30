"use client"

import { useEffect, useRef, useState } from "react"

// The estimator's controls. Holds NO prices: every change posts the choices to
// /api/estimate and shows what comes back.

type Level = "simple" | "story" | "produced"
type Result = {
  low: number
  high: number
  from: number
  flexible: { applied: boolean; pctLabel: string; saved: number; heldAtFloor: boolean }
}

const LEVELS: { id: Level; name: string; note: string }[] = [
  { id: "simple", name: "Simple", note: "One person talking, one place. A testimonial." },
  { id: "story", name: "A story", note: "A few people, a couple of places. Most of our work." },
  { id: "produced", name: "Big production", note: "More setups, more people, a bigger day." },
]

const money = (n: number) => "$" + n.toLocaleString("en-US")

export default function Estimator({ mode }: { mode: "range" | "floor" }) {
  const [level, setLevel] = useState<Level>("simple")
  const [shootDays, setShootDays] = useState(1)
  const [videos, setVideos] = useState(1)
  const [drone, setDrone] = useState(false)
  const [socialCuts, setSocialCuts] = useState(false)
  const [flexibleDates, setFlexibleDates] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ level, shootDays, videos, drone, socialCuts, flexibleDates }),
        })
        const j = await r.json()
        if (id === seq.current && r.ok) setResult(j)
      } catch {
        /* keep the last number */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [level, shootDays, videos, drone, socialCuts, flexibleDates])

  return (
    <div className="pe-card">
      <fieldset className="pe-q">
        <legend>What kind of video?</legend>
        <div className="pe-levels">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={"pe-level" + (level === l.id ? " on" : "")}
              aria-pressed={level === l.id}
              onClick={() => setLevel(l.id)}
            >
              <b>{l.name}</b>
              <span>{l.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="pe-q">
        <span className="pe-qh">
          How many shoot days? <b>{shootDays}</b>
        </span>
        <input type="range" min={1} max={5} step={1} value={shootDays} onChange={(e) => setShootDays(+e.target.value)} />
        <span className="pe-scale"><i>1</i><i>5</i></span>
      </label>

      <label className="pe-q">
        <span className="pe-qh">
          How many finished videos? <b>{videos}</b>
        </span>
        <input type="range" min={1} max={6} step={1} value={videos} onChange={(e) => setVideos(+e.target.value)} />
        <span className="pe-sub">Each one up to about 4 minutes.</span>
      </label>

      <div className="pe-q">
        <span className="pe-qh">Extras</span>
        <label className="pe-check">
          <input type="checkbox" checked={drone} onChange={(e) => setDrone(e.target.checked)} />
          <span>Drone shots</span>
        </label>
        <label className="pe-check">
          <input type="checkbox" checked={socialCuts} onChange={(e) => setSocialCuts(e.target.checked)} />
          <span>Short cut-downs for social</span>
        </label>
      </div>

      <label className="pe-flex">
        <input type="checkbox" checked={flexibleDates} onChange={(e) => setFlexibleDates(e.target.checked)} />
        <span>
          <b>I&rsquo;m flexible on dates</b>
          <span>Let us pick a shoot date that fits our calendar and you pay less.</span>
          <em className="pe-drafttag">{result?.flexible.pctLabel ?? "DRAFT %"} · amount not set yet</em>
        </span>
      </label>

      <div className="pe-result" aria-live="polite">
        {!result ? (
          <p className="pe-num">…</p>
        ) : mode === "floor" || result.low === result.high ? (
          <>
            <p className="pe-say">Projects like this start at</p>
            <p className="pe-num">{money(result.from)}</p>
          </>
        ) : (
          <>
            <p className="pe-say">Most projects like this land between</p>
            <p className="pe-num">
              {money(result.low)}<span className="pe-dash">&ndash;</span>{money(result.high)}
            </p>
          </>
        )}
        {result?.flexible.applied && result.flexible.saved > 0 && (
          <p className="pe-save">About {money(result.flexible.saved)} less with flexible dates.</p>
        )}
        {result?.flexible.applied && result.flexible.heldAtFloor && (
          <p className="pe-save dim">$3,999 is our floor, so the smallest jobs stay there.</p>
        )}
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
