// One screen of Start a project v3 (SPEC §31 v2), drawn from what's SAVED (a refused save never loses a word: the
// screen redraws from the draft, with each problem next to its field). No client JS: rows add and remove with submit
// buttons, the shoot and posting questions hide with CSS :has, uploads are their own forms on the assets screen.
// `look` draws the same screen read-only for staff viewing, the demo and preview sign-ins (they can't POST).
import Link from "next/link"
import { Paperclip, X } from "lucide-react"
import {
  CEILING, SCREENS, STEPS, nextStep, prevStep, stepNumber, type Column, type Field, type Problems, type Row, type ScreenValues, type Step,
  type StoredFile,
} from "@/lib/client/request-form"

type Props = {
  step: Step
  values: ScreenValues
  problems: Problems
  mode: "edit" | "look"
  /** The draft's id; absent on the very first screen before anything is saved. */
  id?: string
  /** Who is sending (the session's truth, shown on the first screen). */
  who?: { name: string; email: string; company: string }
  files?: StoredFile[]
  upload?: string | null
  /** Came from Review's "Change": a complete save goes straight back to Review. */
  fromReview?: boolean
}

const UPLOAD_WORDS: Record<string, string> = {
  ok: "Uploaded.",
  type: "That kind of file isn't one we can take. PDF, images, design files, fonts and documents are fine.",
  size: "That file is over 25 MB. Send it to Sam instead, or a smaller version.",
  count: "That's the most files one request can hold. Send the rest to Sam.",
  state: "This request can't take files right now.",
  store: "That didn't upload. Try again in a minute.",
  none: "Pick a file first.",
}

export function RequestScreen({ step, values, problems, mode, id, who, files = [], upload, fromReview = false }: Props) {
  const screen = SCREENS[step]
  const n = stepNumber(step)
  const look = mode === "look"
  const has = Object.keys(problems).length > 0
  const nextHref = nextStep(step) === "review" ? null : `/client/start/look/${nextStep(step)}`
  // Listed: everything not removed or failed (an upload a deploy cut short shows as "didn't finish", with Remove).
  // Counted: stored files only, as the server counts them (built review: a stuck upload must not hide "later").
  const live = files.filter((f) => !f.removed_at && (f as { state?: string }).state !== "failed")
  const stored = live.filter((f) => (f as { state?: string }).state !== "uploading")
  // v5: "I'll send these later" shows only while nothing is uploaded.
  const fields = screen.fields.filter(
    (f) => !(screen.billing ?? []).includes(f.name) && !(f.name === "brand_assets_later" && stored.length > 0),
  )
  const billing = screen.fields.filter((f) => (screen.billing ?? []).includes(f.name))
  const billingOpen = billing.some((f) => valueText(values[f.name]) || problems[f.name])

  const body = (
    <>
      {step === "about" && who ? (
        <p className="cs-q-who">
          Sending as <b>{who.name}</b> · {who.email} · {who.company}
        </p>
      ) : null}
      {has ? (
        <p className="cs-form-error" role="alert">
          A few answers need a look. They&rsquo;re marked below; everything you typed is saved.
        </p>
      ) : null}
      {fields.map((f) => (
        <FieldBlock key={f.name} f={f} values={values} problems={problems} look={look} screenShoot={screen.shoot} />
      ))}
      {billing.length ? (
        <details className="cs-details" open={billingOpen || undefined}>
          <summary>Billing details</summary>
          <p className="cs-q-help">We need these to invoice. They can wait until after we&rsquo;ve agreed on terms.</p>
          {billing.map((f) => (
            <FieldBlock key={f.name} f={f} values={values} problems={problems} look={look} />
          ))}
        </details>
      ) : null}
      {step === "assets" && problems.brand_assets ? <p className="cs-q-err">{problems.brand_assets}</p> : null}
    </>
  )

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">
        Start a project · Step {n} of {STEPS.length}
      </p>
      <div className="cs-q-progress" aria-hidden>
        <i style={{ width: `${(n / STEPS.length) * 100}%` }} />
      </div>
      <h1 className="cs-title" style={{ marginTop: 10 }}>{screen.title}</h1>
      {screen.intro ? <p className="cs-lede">{screen.intro}</p> : null}

      {step === "assets" ? <AssetsBlock id={id} files={live} look={look} upload={upload ?? null} /> : null}

      {look ? (
        <div className="cs-start cs-q">
          {body}
          <div className="cs-q-bar">
            {nextHref ? <Link className="cs-btn" href={nextHref}>Next</Link> : <span className="cs-status">Send is off while viewing.</span>}
            {step !== "about" ? <Link className="cs-btn ghost" href={`/client/start/look/${prevStep(step)}`}>Back</Link> : null}
          </div>
        </div>
      ) : (
        // noValidate: the browser's own checks (a URL without https://, a number out of range) would refuse EVERY
        // button, Finish later included, before a word is saved; the server checks instead (built review).
        <form action="/client/start/save" method="post" className="cs-start cs-q" noValidate>
          {/* The keyboard's Go presses the FIRST submit button in the form. This one, drawn but out of sight (Safari
              skips buttons that aren't rendered), makes that Save, never a row's Add or Remove. */}
          <button className="cs-q-default" name="op" value="next" tabIndex={-1} aria-hidden="true">Save and continue</button>
          {id ? <input type="hidden" name="id" value={id} /> : null}
          <input type="hidden" name="step" value={step} />
          {fromReview ? <input type="hidden" name="from" value="review" /> : null}
          {body}
          {/* "Save and continue" comes FIRST in the markup: the keyboard's Go presses the first submit button. CSS puts
              Back on the left. */}
          <div className="cs-q-bar">
            <button className="cs-btn" name="op" value="next">{nextStep(step) === "review" ? "Review" : "Save and continue"}</button>
            {step !== "about" ? <button className="cs-btn ghost cs-q-back" name="op" value="back">Back</button> : null}
            <button className="cs-q-later" name="op" value="later">Finish later</button>
          </div>
        </form>
      )}
    </main>
  )
}

const valueText = (v: unknown) => (typeof v === "string" ? v : "")

function Err({ name, problems }: { name: string; problems: Problems }) {
  return problems[name] ? <p className="cs-q-err" id={`err-${name}`}>{problems[name]}</p> : null
}

function FieldBlock({ f, values, problems, look, screenShoot }: { f: Field; values: ScreenValues; problems: Problems; look: boolean; screenShoot?: string[] }) {
  const v = values[f.name]
  const wrap = (node: React.ReactNode) =>
    screenShoot?.includes(f.name) ? <div className="cs-q-shoot">{node}</div> : f.type === "check" && f.showWhen === "posting" ? <div className="cs-q-posting">{node}</div> : node
  const help = f.help ? <small className="cs-q-help">{f.help}</small> : null
  const describedBy = problems[f.name] ? `err-${f.name}` : undefined

  if (f.type === "rows") return <RowsBlock f={f} rows={Array.isArray(v) ? (v as Row[]) : []} problems={problems} look={look} />
  if (f.type === "radio" || f.type === "yesno" || f.type === "checks") {
    const choices = f.type === "yesno" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : f.choices
    const multi = f.type === "checks"
    const picked = multi ? (Array.isArray(v) ? (v as string[]) : []) : [valueText(v)]
    return wrap(
      <fieldset className={f.type === "yesno" ? "cs-q-yesno" : undefined}>
        <legend>{f.label}</legend>
        {help}
        {choices.map((c) => (
          <label key={c.value} className="cs-choice">
            <input type={multi ? "checkbox" : "radio"} name={f.name} value={c.value} defaultChecked={picked.includes(c.value)} disabled={look} />
            <span><b>{c.label}</b></span>
          </label>
        ))}
        <Err name={f.name} problems={problems} />
      </fieldset>,
    )
  }
  if (f.type === "check") {
    return wrap(
      <label className="cs-choice">
        <input type="checkbox" name={f.name} defaultChecked={v === true} disabled={look} />
        <span><b>{f.label}</b></span>
      </label>,
    )
  }
  if (f.type === "select") {
    return wrap(
      <label className="cs-field">
        <span>{f.label}</span>
        {help}
        <select name={f.name} defaultValue={valueText(v)} disabled={look} aria-describedby={describedBy}>
          <option value="">Choose…</option>
          {f.choices.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Err name={f.name} problems={problems} />
      </label>,
    )
  }
  const common = { name: f.name, defaultValue: valueText(v), disabled: look, maxLength: CEILING, "aria-describedby": describedBy, placeholder: f.placeholder }
  return wrap(
    <label className="cs-field">
      <span>{f.label}</span>
      {help}
      {f.type === "long" ? (
        <textarea rows={4} {...common} />
      ) : (
        <input type={f.type === "url" ? "url" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"} inputMode={f.type === "url" ? "url" : undefined} autoComplete={f.type === "tel" ? "tel" : "off"} {...common} />
      )}
      <Err name={f.name} problems={problems} />
    </label>,
  )
}

function RowsBlock({ f, rows, problems, look }: { f: Extract<Field, { type: "rows" }>; rows: Row[]; problems: Problems; look: boolean }) {
  const one = f.name === "deliverables" ? "Deliverable" : "Handle"
  return (
    <fieldset className="cs-q-rows" id={f.name}>
      <legend>{f.label}</legend>
      {f.help ? <small className="cs-q-help">{f.help}</small> : null}
      <input type="hidden" name={`${f.name}.count`} value={rows.length} />
      {rows.map((row, i) => (
        <div key={i} className="cs-q-row">
          <div className="cs-q-row-head">
            <b>{rows.length > 1 || f.name === "deliverables" ? `${one} ${i + 1}` : one}</b>
            {!look && (rows.length > f.minRows || f.minRows === 0) ? (
              <button className="cs-q-remove" name="op" value={`remove:${f.name}:${i}`} aria-label={`Remove ${one.toLowerCase()} ${i + 1}`}>
                Remove
              </button>
            ) : null}
          </div>
          {f.columns.map((c) => (
            <Cell key={c.name} field={f.name} i={i} c={c} row={row} problems={problems} look={look} />
          ))}
        </div>
      ))}
      <Err name={f.name} problems={problems} />
      {!look && rows.length < f.maxRows ? (
        <button className="cs-btn ghost cs-q-add" name="op" value={`add:${f.name}`}>{f.addText}</button>
      ) : null}
    </fieldset>
  )
}

function Cell({ field, i, c, row, problems, look }: { field: string; i: number; c: Column; row: Row; problems: Problems; look: boolean }) {
  const key = `${field}.${i}.${c.name}`
  const v = row[c.name]
  if (c.type === "checks") {
    const picked = Array.isArray(v) ? v : []
    return (
      <fieldset className="cs-q-inline">
        <legend>{c.label}</legend>
        {c.choices.map((ch) => (
          <label key={ch.value} className="cs-q-chip">
            <input type="checkbox" name={key} value={ch.value} defaultChecked={picked.includes(ch.value)} disabled={look} />
            <span>{ch.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }
  if (c.type === "select") {
    return (
      <div className="cs-q-select">
        <label className="cs-field">
          <span>{c.label}</span>
          <select name={key} defaultValue={typeof v === "string" ? v : ""} disabled={look}>
            <option value="">Choose…</option>
            {c.choices.map((ch) => (
              <option key={ch.value} value={ch.value}>{ch.label}</option>
            ))}
            {c.other ? <option value="other">{c.other}</option> : null}
          </select>
          <Err name={key} problems={problems} />
        </label>
        {c.other ? (
          <label className="cs-field cs-q-other">
            <span>What is it?</span>
            <input type="text" name={`${key}_other`} defaultValue={typeof row[`${c.name}_other`] === "string" ? (row[`${c.name}_other`] as string) : ""} disabled={look} maxLength={CEILING} />
            <Err name={`${key}_other`} problems={problems} />
          </label>
        ) : null}
      </div>
    )
  }
  return (
    <label className="cs-field">
      <span>{c.label}</span>
      <input
        type={c.type === "number" ? "number" : "text"}
        inputMode={c.type === "number" ? "numeric" : undefined}
        min={c.type === "number" ? c.min : undefined}
        max={c.type === "number" ? c.max : undefined}
        name={key}
        defaultValue={typeof v === "string" ? v : ""}
        placeholder={c.type === "text" ? c.placeholder : undefined}
        disabled={look}
        maxLength={c.type === "text" ? CEILING : undefined}
      />
      <Err name={key} problems={problems} />
    </label>
  )
}

/** The brand-assets screen's own forms: one file per Upload (a failed upload loses no typed answers), Remove per file. */
function AssetsBlock({ id, files, look, upload }: { id?: string; files: StoredFile[]; look: boolean; upload: string | null }) {
  return (
    <section className="cs-q-assets">
      <p className="cs-q-help">Logo (vector if you have it), style guide, fonts, colors: anything with your look.</p>
      {files.length ? (
        <ul className="cs-q-files">
          {files.map((f) => (
            <li key={f.n}>
              <Paperclip size={16} aria-hidden />
              <span>{f.name}{(f as { state?: string }).state === "uploading" ? " (didn't finish uploading)" : ""}</span>
              {!look && id ? (
                <form action="/client/start/remove" method="post">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="n" value={f.n} />
                  <button className="cs-q-remove" aria-label={`Remove ${f.name}`}><X size={14} /> Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {upload ? <p className={upload === "ok" ? "cs-q-ok" : "cs-q-err"} role="status">{UPLOAD_WORDS[upload] ?? UPLOAD_WORDS.store}</p> : null}
      {look ? (
        <p className="cs-status">Uploads are off while viewing.</p>
      ) : id ? (
        <form action="/client/start/upload" method="post" encType="multipart/form-data" className="cs-q-upload">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value="form" />
          <label className="cs-field">
            <span>Upload your brand assets</span>
            <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.psd,.zip,.otf,.ttf,.woff,.woff2,.txt,.doc,.docx,.key,.pptx" />
          </label>
          <button className="cs-btn ghost">Upload</button>
          <small className="cs-q-help">One file at a time, up to 25 MB each.</small>
        </form>
      ) : null}
    </section>
  )
}
