"use client"
// Staging's Comment button (client-website SPEC §32 v2; Sam 10/8: "I want to be able to just browse it and comment").
// Rendered by the root layout on staging only, and it SHOWS only when the password form's readable cookie is there
// (never for the screenshot harness, the demo, or on the gate page itself). Bottom-left, lifted above the client
// pages' tab bar. A note goes to /api/staging/comment with the page and the viewport; the server adds the rest.
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const UI_COOKIE = "osc_gate_ui=1"
type Status = "idle" | "sending" | "sent" | "failed"

const CSS = `
.osc-sc-btn { position: fixed; left: 12px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px 0 12px; border-radius: 999px; border: 1px solid rgba(247, 246, 243, 0.28); background: #141412; color: #f7f6f3; font: 600 14px/1 var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 6px 20px -6px rgba(0, 0, 0, 0.45); cursor: pointer; }
.osc-sc-btn svg { width: 18px; height: 18px; }
.osc-sc-btn:focus-visible, .osc-sc-sheet button:focus-visible { outline: 2px solid #e07830; outline-offset: 2px; }
.osc-sc-veil { position: fixed; inset: 0; z-index: 2147483001; background: rgba(20, 20, 18, 0.45); }
.osc-sc-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483002; background: #f7f6f3; color: #141412; border-radius: 16px 16px 0 0; padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 10px; font: 400 15px/1.4 var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 -10px 30px -12px rgba(0, 0, 0, 0.4); }
.osc-sc-sheet h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.osc-sc-where { color: #64635e; font-size: 13px; overflow-wrap: anywhere; }
.osc-sc-sheet textarea { width: 100%; min-height: 120px; resize: vertical; border-radius: 10px; border: 1px solid rgba(20, 20, 18, 0.2); background: #fff; color: #141412; padding: 10px 12px; font: inherit; font-size: 16px; }
.osc-sc-sheet textarea:focus { outline: 2px solid #e07830; outline-offset: 1px; }
.osc-sc-row { display: flex; gap: 10px; justify-content: flex-end; align-items: center; }
.osc-sc-row button { height: 44px; padding: 0 18px; border-radius: 999px; font: 600 15px/1 var(--font-inter), -apple-system, sans-serif; cursor: pointer; }
.osc-sc-send { border: 0; background: #141412; color: #f7f6f3; }
.osc-sc-send[disabled] { opacity: 0.5; cursor: default; }
.osc-sc-cancel { border: 1px solid rgba(20, 20, 18, 0.2); background: transparent; color: #141412; }
.osc-sc-msg { font-size: 14px; margin-right: auto; }
.osc-sc-msg.failed { color: #9b2a20; }
@media (min-width: 640px) {
  .osc-sc-sheet { left: 16px; right: auto; bottom: 16px; width: 420px; border-radius: 16px; padding-bottom: 16px; }
}
@media (prefers-color-scheme: dark) {
  .osc-sc-sheet { background: #1f1f1c; color: #f7f6f3; }
  .osc-sc-where { color: rgba(247, 246, 243, 0.66); }
  .osc-sc-sheet textarea { background: #141412; color: #f7f6f3; border-color: rgba(247, 246, 243, 0.22); }
  .osc-sc-send { background: #e07830; color: #141412; }
  .osc-sc-cancel { color: #f7f6f3; border-color: rgba(247, 246, 243, 0.25); }
  .osc-sc-msg.failed { color: #ffb4a8; }
}
`

export function StagingComment() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [lift, setLift] = useState(0)
  const [where, setWhere] = useState("")
  const box = useRef<HTMLTextAreaElement>(null)

  // Shown only with the password form's cookie, never on the gate page; lifted above a visible tab bar.
  useEffect(() => {
    const measure = () => {
      const on = document.cookie.split(";").some((c) => c.trim() === UI_COOKIE) && !document.querySelector("[data-staging-gate]")
      setShow(on)
      const tabs = document.querySelector<HTMLElement>(".cs-tabs")
      const h = tabs ? tabs.getBoundingClientRect().height : 0
      setLift(h > 0 ? Math.ceil(h) : 0)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    setWhere(window.location.pathname + window.location.search)
    box.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!show) return null

  async function send() {
    const words = note.trim()
    if (!words || status === "sending") return
    setStatus("sending")
    try {
      const res = await fetch("/api/staging/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          note: words,
          path: window.location.pathname + window.location.search,
          title: document.title,
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setStatus("sent")
      setNote("")
      window.setTimeout(() => {
        setOpen(false)
        setStatus("idle")
      }, 1800)
    } catch {
      setStatus("failed") // the words stay in the box
    }
  }

  return (
    <>
      <style>{CSS}</style>
      {open ? (
        <>
          <div className="osc-sc-veil" onClick={() => status !== "sending" && setOpen(false)} />
          <div className="osc-sc-sheet" role="dialog" aria-modal="true" aria-labelledby="osc-sc-title">
            <h2 id="osc-sc-title">What should change here?</h2>
            <p className="osc-sc-where">{where === "/" ? "On the home page" : `On ${where || "this page"}`}</p>
            <textarea
              ref={box}
              value={note}
              maxLength={4000}
              onChange={(e) => {
                setNote(e.target.value)
                if (status === "failed") setStatus("idle")
              }}
              aria-label="Your note"
            />
            <div className="osc-sc-row">
              {status === "sent" ? (
                <span className="osc-sc-msg" role="status">
                  Sent. It’s in the notes for this page.
                </span>
              ) : status === "failed" ? (
                <span className="osc-sc-msg failed" role="alert">
                  Didn’t send. Check your connection and try again.
                </span>
              ) : null}
              <button type="button" className="osc-sc-cancel" onClick={() => setOpen(false)} disabled={status === "sending"}>
                {status === "sent" ? "Close" : "Cancel"}
              </button>
              <button type="button" className="osc-sc-send" onClick={send} disabled={!note.trim() || status === "sending" || status === "sent"}>
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="osc-sc-btn"
          style={{ bottom: lift ? `${lift + 12}px` : "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          onClick={() => {
            setStatus("idle")
            setOpen(true)
          }}
          aria-label="Comment on this page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Comment
        </button>
      )}
    </>
  )
}
