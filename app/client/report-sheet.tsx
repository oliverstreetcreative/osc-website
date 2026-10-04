"use client"
// "Something's wrong?" (SPEC §29 v2, Sam 10/4 16:15): one tap opens the sheet, the text box is focused inside that
// tap (so iOS raises the keyboard), a screenshot is taken in the background (only if the screenshot library has been
// installed at /vendor/; until then the report goes without one, and the sheet says so), and Send makes a ticket.
// Everything sent is UNTRUSTED on the server, which keeps a route template, never the path, and caps everything. The
// browser runs the same redactor first, so a token in an error message never even leaves the device.
import { useEffect, useRef, useState } from "react"
import { DIAG_KEY } from "@/lib/support/recorder"
import { redact } from "@/lib/support/safety"

const OPEN = "osc:report"

/** Anywhere on a page: a quiet link that opens the one report sheet. */
export function ReportLink({ label = "Something's wrong?", className = "cs-link" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN))}>
      {label}
    </button>
  )
}

type Shot = { state: "none" } | { state: "taking" } | { state: "ready"; url: string } | { state: "unavailable" }

async function takeScreenshot(sheet: HTMLElement | null): Promise<string | null> {
  try {
    // The library is loaded at RUNTIME only if it exists (no build dependency): /vendor/html2canvas-pro.esm.js.
    const mod = await import(/* webpackIgnore: true */ "/vendor/html2canvas-pro.esm.js" as string)
    const html2canvas = (mod.default ?? mod) as (el: HTMLElement, o: Record<string, unknown>) => Promise<HTMLCanvasElement>
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: false,
      scale: 1,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      ignoreElements: (el: Element) =>
        (sheet && sheet.contains(el)) ||
        el.matches?.("input, textarea, select, [contenteditable], [data-private]") === true,
    })
    let q = 0.72
    let url = canvas.toDataURL("image/jpeg", q)
    while (url.length > 1_300_000 && q > 0.3) {
      q -= 0.15
      url = canvas.toDataURL("image/jpeg", q)
    }
    return url.length <= 1_300_000 ? url : null
  } catch {
    return null // no library yet, a cross-site image that won't draw (SecurityError), or anything else: no screenshot
  }
}

function diagnostics() {
  let d: { errors?: unknown[]; failed?: unknown[] } = {}
  try {
    d = JSON.parse(sessionStorage.getItem(DIAG_KEY) || "{}")
  } catch {}
  const errors = (Array.isArray(d.errors) ? d.errors.slice(-20) : []).map((e) => {
    const x = (e && typeof e === "object" ? e : {}) as { kind?: unknown; msg?: unknown; at?: unknown }
    return { kind: x.kind, msg: typeof x.msg === "string" ? redact(x.msg).slice(0, 300) : "", at: x.at }
  })
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    scheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    online: navigator.onLine,
    errors,
    failed: Array.isArray(d.failed) ? d.failed.slice(-20) : [],
  }
}

const FOCUSABLE = 'button:not([disabled]), [href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The one sheet, rendered once per page chrome (hidden) so its text box exists when the tap needs to focus it.
 *  `followLink` off where "Your reports" isn't reachable (the Scripts pages: someone who only has scripts has no shell). */
export function ReportSheet({ demo = false, followLink = true }: { demo?: boolean; followLink?: boolean }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [shot, setShot] = useState<Shot>({ state: "none" })
  const [sent, setSent] = useState<null | { number?: number; error?: string }>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const done = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onOpen = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
      setSent(null)
      // Focus synchronously, inside the tap that opened us: iOS raises the keyboard only then. The text box is always
      // mounted while the sheet is closed (close() puts the form back), so it's there to take the focus.
      if (sheet.current) sheet.current.hidden = false
      box.current?.focus()
      setShot({ state: "taking" })
      void takeScreenshot(sheet.current).then((url) => setShot(url ? { state: "ready", url } : { state: "unavailable" }))
    }
    window.addEventListener(OPEN, onOpen)
    return () => window.removeEventListener(OPEN, onOpen)
  }, [])

  // After a send, the Done button takes the focus (and the thanks is announced).
  useEffect(() => {
    if (sent?.number) done.current?.focus()
  }, [sent])

  const close = () => {
    setOpen(false)
    setText("")
    setShot({ state: "none" })
    setSent(null) // back to the form, so the next tap has a text box to focus (review 10/4)
    opener.current?.focus?.()
  }

  // Escape closes; Tab stays inside the sheet while it's open.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== "Tab" || !sheet.current) return
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch("/client/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: redact(text).slice(0, 2000),
          route: window.location.pathname,
          context: diagnostics(),
          screenshot: shot.state === "ready" ? shot.url : undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { number?: number; error?: string }
      if (res.ok && body.number) setSent({ number: body.number })
      else setSent({ error: res.status === 429 ? "busy" : res.status === 403 ? "read_only" : "failed" })
    } catch {
      setSent({ error: "failed" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={sheet}
      data-report-sheet
      className="cs-sheet-wrap"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Report a problem"
      onKeyDown={onKeyDown}
    >
      <div className="cs-sheet">
        {sent?.number ? (
          <div role="status" aria-live="polite">
            <h2>Thanks: Sam has it.</h2>
            <p>
              Report #{sent.number}.{followLink ? <> You can follow it on <a href="/client/support">Your reports</a>.</> : null}
            </p>
            <button ref={done} type="button" className="cs-btn" onClick={close}>Done</button>
          </div>
        ) : (
          <>
            <h2>Something&rsquo;s wrong?</h2>
            <label htmlFor="cs-report-text" className="cs-lede">Tell us what you&rsquo;re seeing.</label>
            <textarea
              id="cs-report-text"
              ref={box}
              value={text}
              maxLength={2000}
              rows={4}
              onChange={(e) => setText(e.target.value)}
              placeholder="The play button does nothing on my phone…"
            />
            {shot.state === "taking" ? <p className="cs-sheet-note">Taking a picture of the page…</p> : null}
            {shot.state === "ready" ? (
              <div className="cs-sheet-shot">
                <img src={shot.url} alt="A picture of the page, as you saw it" />
                <button type="button" className="cs-link" onClick={() => setShot({ state: "none" })}>Remove screenshot</button>
              </div>
            ) : null}
            <p className="cs-sheet-note">
              {shot.state === "unavailable" ? "No picture of the page this time. " : null}
              We also send the page you&rsquo;re on, your device, and any errors the page hit.
            </p>
            {sent?.error ? (
              <p className="cs-sheet-error" role="alert">
                {sent.error === "busy"
                  ? "We've got a lot of reports right now. Please text Sam."
                  : sent.error === "read_only"
                    ? "You're viewing as a client: report as yourself instead."
                    : "That didn't send. Please text Sam."}
              </p>
            ) : null}
            <div className="cs-sheet-act">
              <button type="button" className="cs-link" onClick={close}>Cancel</button>
              {demo ? (
                <span className="cs-status">Off in the demo</span>
              ) : (
                <button type="button" className="cs-btn" disabled={!text.trim() || busy || shot.state === "taking"} onClick={send}>
                  {busy ? "Sending…" : "Send"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
