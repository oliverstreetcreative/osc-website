"use client"
// Version history (SPEC §14 phone moment 5): autosaved points and named versions; View shows what a version said;
// editors can name the current state and Restore (a NEW version made from an old one; nothing is lost).
import { useCallback, useEffect, useState } from "react"

type Version = { n: number; name: string | null; kind: string; at: string; by: string | null; authors: string[]; total_seconds: number | null }
type Part = { op: "=" | "+" | "-"; text: string }
type Shown = { n: number; text: string; diff: Part[] | null; comparedTo: number | null }

const KIND: Record<string, string> = { auto: "Autosaved", named: "Named", restore: "Restored", approved: "Approved", import: "Imported" }

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}
const mmss = (s: number | null) => (s === null ? "" : `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`)

export function History({ scriptId, canManage, onClose }: { scriptId: string; canManage: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/scripts/${scriptId}/versions`, { cache: "no-store" }).catch(() => null)
    if (!res?.ok) {
      setError("History needs a connection. Try again when you're back online.")
      return
    }
    setVersions((await res.json()).versions)
  }, [scriptId])
  useEffect(() => {
    load()
  }, [load])

  const view = async (n: number) => {
    if (shown?.n === n) return setShown(null)
    const res = await fetch(`/api/scripts/${scriptId}/versions/${n}`, { cache: "no-store" }).catch(() => null)
    if (res?.ok) {
      const v = await res.json()
      setShown({ n, text: v.text, diff: v.diff, comparedTo: v.compared_to })
    }
  }
  const name = async () => {
    const label = window.prompt("Name this version (for example: Mike's edits)")
    if (!label) return
    setBusy(true)
    const res = await fetch(`/api/scripts/${scriptId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: label }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "Couldn't save the name. Try again.")
    else load()
  }
  const restore = async (v: Version) => {
    if (!window.confirm(`Restore version ${v.n}? The script goes back to what it said then, as a new version. Nothing is lost.`)) return
    setBusy(true)
    const res = await fetch(`/api/scripts/${scriptId}/versions/${v.n}/restore`, { method: "POST" }).catch(() => null)
    setBusy(false)
    if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "Couldn't restore. Try again.")
    else load()
  }

  return (
    <section className="sc-history" aria-label="Version history">
      <div className="cs-h2">
        <span>History</span>
        <span className="sc-sugs-all">
          {canManage ? (
            <button type="button" className="cs-btn sm ghost" disabled={busy} onClick={name}>
              Name this version
            </button>
          ) : null}
          <button type="button" className="cs-btn sm ghost" onClick={onClose}>
            Close
          </button>
        </span>
      </div>
      {error ? <p className="sc-note bad">{error}</p> : null}
      {!versions ? (
        <p className="sc-loading">Loading…</p>
      ) : !versions.length ? (
        <p className="sc-loading">No versions yet.</p>
      ) : (
        <ul className="sc-sug-list">
          {versions.map((v) => (
            <li key={v.n} className="sc-ver">
              <div className="sc-ver-row">
                <span className="sc-sug-who">v{v.n}</span>
                <span className="sc-sug-what">
                  <b>{v.name ?? KIND[v.kind] ?? v.kind}</b> · {when(v.at)}
                  {v.authors.length ? ` · ${v.authors.join(", ")}` : v.by ? ` · ${v.by}` : ""}
                  {v.total_seconds !== null ? ` · ${mmss(v.total_seconds)}` : ""}
                </span>
                <span className="sc-sug-acts">
                  <button type="button" className="cs-btn sm ghost" onClick={() => view(v.n)} aria-expanded={shown?.n === v.n}>
                    {shown?.n === v.n ? "Hide" : "View"}
                  </button>
                  {canManage ? (
                    <button type="button" className="cs-btn sm ghost" disabled={busy} onClick={() => restore(v)}>
                      Restore
                    </button>
                  ) : null}
                </span>
              </div>
              {shown?.n === v.n ? (
                shown.diff && shown.diff.some((p) => p.op !== "=") ? (
                  <>
                    <p className="sc-loading">What changed since version {shown.comparedTo}:</p>
                    <pre className="sc-ver-text">
                      {shown.diff.map((p, i) =>
                        p.op === "=" ? <span key={i}>{p.text}</span> : p.op === "+" ? <ins key={i} className="s-ins">{p.text}</ins> : <del key={i} className="s-del">{p.text}</del>,
                      )}
                    </pre>
                  </>
                ) : (
                  <>
                    {shown.diff ? <p className="sc-loading">No change in the words since version {shown.comparedTo}.</p> : null}
                    <pre className="sc-ver-text">{shown.text}</pre>
                  </>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
