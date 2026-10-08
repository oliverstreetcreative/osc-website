// "Where the hours go" (FAQ #1; website-redesign SPEC Feature 4). A server component with NO client JavaScript:
// the kinds are native radios, the phone switch is a native checkbox, the steps are <details>. CSS :has() reads
// which is checked and shows that kind's numbers (components/site/site.css, "where the hours go"), so it works
// the moment the HTML paints, on a slow phone connection or with JavaScript off. Browsers without :has() get the
// first kind as a captioned still picture and no controls.
//
// Every kind's numbers are in the page; CSS shows one set. The bar's two segments grow by custom properties
// (--cap-<kind>, --story-<kind>) so switching kinds animates. One piece per page: the radio group's name is fixed.
// The words live in lib/story-hours.ts (PIECE), where the house-voice test reads them.
import type { CSSProperties } from "react"
import { KINDS, PIECE, STEPS, hrs, kindSummary, storyTotal } from "@/lib/story-hours"

export function StoryHours({ placeholder }: { placeholder: boolean }) {
  const vars: Record<string, number> = {}
  for (const k of KINDS) {
    vars[`--cap-${k.key}`] = k.filming
    vars[`--story-${k.key}`] = storyTotal(k)
  }
  const most = Object.fromEntries(KINDS.map((k) => [k.key, Math.max(...k.steps)]))

  return (
    <div className="site-sh" style={vars as CSSProperties}>
      <div className="cs-eyebrow">{PIECE.eyebrow}</div>
      <h3 className="site-sh-h">{PIECE.heading}</h3>
      {placeholder ? <span className="cs-pill site-sh-ph">{PIECE.placeholderPill}</span> : null}

      {/* the row is a div inside the fieldset: older Safari won't make a fieldset itself a flex container */}
      <fieldset className="site-sh-kinds site-sh-ctl">
        <legend className="sr-only">{PIECE.kindsLegend}</legend>
        <div className="site-sh-row">
          {KINDS.map((k, i) => (
            <label key={k.key} className="site-sh-chip">
              <input className="site-sh-k" type="radio" name="sh-kind" value={k.key} defaultChecked={i === 0} />
              <span>{k.label}</span>
              {/* heard with the choice, since the numbers it changes sit further down */}
              <span className="sr-only">{`: ${kindSummary(k)}`}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* shown only where the controls can't work (no :has()), so the still picture says what it is */}
      <p className="site-sh-still">{PIECE.stillCaption}</p>

      <div className="site-sh-bar" aria-hidden="true">
        <span className="site-sh-cap" />
        <span className="site-sh-story" />
      </div>
      <div className="site-sh-legend">
        <p>
          {KINDS.map((k) => (
            <b key={k.key} data-k={k.key}>
              {hrs(k.filming)}
            </b>
          ))}
          <span className="site-sh-off">{PIECE.filming}</span>
          <span className="site-sh-on">{PIECE.filmingMine}</span>
        </p>
        <p className="site-sh-r">
          {KINDS.map((k) => (
            <b key={k.key} data-k={k.key}>
              {hrs(storyTotal(k))}
            </b>
          ))}
          <span>{PIECE.story}</span>
        </p>
      </div>

      <label className="cs-choice site-sh-diy site-sh-ctl">
        <input className="site-sh-me" type="checkbox" name="sh-diy" />
        <span>
          <b>{PIECE.switchLabel}</b>
          <small className="site-sh-off">{PIECE.switchOff}</small>
          <small className="site-sh-on">{PIECE.switchOn}</small>
        </span>
      </label>

      <p className="site-sh-steps-h">{PIECE.stepsHeading}</p>
      {/* role="list": WebKit drops list semantics from a list-style:none list */}
      <ol className="site-sh-steps" role="list">
        {STEPS.map((s, i) => (
          <li key={s.name}>
            <details>
              {/* grid on an inner span, not the summary (older iOS Safari won't grid a <summary>) */}
              <summary>
                <span className="site-sh-srow">
                  <span className="site-sh-nm">{s.name}</span>
                  <span className="site-sh-hr">
                    {KINDS.map((k) => (
                      <span key={k.key} data-k={k.key}>
                        {hrs(k.steps[i])}
                      </span>
                    ))}
                  </span>
                  <svg className="site-sh-chev" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="site-sh-mini" aria-hidden="true">
                    {KINDS.map((k) => (
                      <i key={k.key} data-k={k.key} style={{ width: `${(100 * k.steps[i]) / most[k.key]}%` }} />
                    ))}
                  </span>
                </span>
              </summary>
              <p>{s.why}</p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}
