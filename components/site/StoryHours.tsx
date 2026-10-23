// "Where the hours go" v2 (FAQ #1; website-redesign SPEC Feature 4, rebuilt 10/8 on price-estimator's per-finished-
// minute model). A server component with NO client JavaScript: the kind and the length are native radios, the phone
// switch is a native checkbox. CSS :has() reads which are checked and shows that combination's numbers and bar widths.
// The combination rules are generated here from lib/story-hours.ts, so the numbers live in one place. Without :has(),
// the default (a 3-minute video of people talking) shows as a captioned still picture and the controls are hidden.
import { DEFAULT, KINDS, MINUTES, PIECE, REFERENCE, STEPS, captureHours, days, hrs, pct, shootDays, storyHours, summary } from "@/lib/story-hours"

const combos = KINDS.flatMap((k) => MINUTES.map((m) => ({ k, m, key: `${k.key}-${m}` })))
const def = combos.find((c) => c.k.key === DEFAULT.kind && c.m === DEFAULT.minutes)!

/** The combination rules: which numbers show, and each bar's width. Built from the data, never typed twice. */
function comboCss(): string {
  const both = (k: string, m: number) =>
    `.site-sh:has(.site-sh-k[value="${k}"]:checked):has(.site-sh-m[value="${m}"]:checked)`
  const rules = [
    // the default widths: the still picture without :has(), and the first paint everywhere
    `.site-sh{--cap-w:${pct(captureHours(def.k, def.m))}%;--story-w:${pct(storyHours(def.m))}%}`,
    "@supports selector(:has(*)){",
    ".site-sh [data-c],.site-sh [data-m]{display:none}",
    ...combos.map((c) => `${both(c.k.key, c.m)} [data-c="${c.key}"]{display:block}`),
    ...MINUTES.map((m) => `.site-sh:has(.site-sh-m[value="${m}"]:checked) [data-m="${m}"]{display:block}`),
    ...combos.map(
      (c) => `${both(c.k.key, c.m)}{--cap-w:${pct(captureHours(c.k, c.m))}%;--story-w:${pct(storyHours(c.m))}%}`,
    ),
    "}",
  ]
  return rules.join("\n")
}

export function StoryHours({ draft }: { draft: boolean }) {
  return (
    <div className="site-sh">
      {/* generated from constants only (no user input), so inlining is safe */}
      <style dangerouslySetInnerHTML={{ __html: comboCss() }} />
      <div className="cs-eyebrow">{PIECE.eyebrow}</div>
      <h3 className="site-sh-h">{PIECE.heading}</h3>
      {draft ? <span className="cs-pill site-sh-ph">{PIECE.draftPill}</span> : null}

      {/* each row is a div inside its fieldset: older Safari won't make a fieldset itself a flex container */}
      <fieldset className="site-sh-set site-sh-ctl">
        <legend>{PIECE.kindsLegend}</legend>
        <div className="site-sh-row">
          {KINDS.map((k) => (
            <label key={k.key} className="site-sh-chip">
              <input className="site-sh-k" type="radio" name="sh-kind" value={k.key} defaultChecked={k.key === DEFAULT.kind} />
              <span>{k.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="site-sh-set site-sh-ctl">
        <legend>{PIECE.lengthLegend}</legend>
        <div className="site-sh-row">
          {MINUTES.map((m) => (
            <label key={m} className="site-sh-chip min">
              <input className="site-sh-m" type="radio" name="sh-min" value={m} defaultChecked={m === DEFAULT.minutes} />
              <span>{m} min</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* shown only where the controls can't work (no :has()), so the still picture says what it is */}
      <p className="site-sh-still">{PIECE.stillCaption}</p>

      {/* for screen readers: the chosen combination in one sentence (the bars are decorative) */}
      {combos.map((c) => (
        <p key={c.key} className="sr-only" data-c={c.key}>
          {summary(c.k, c.m)}
        </p>
      ))}

      <div className="site-sh-rows" aria-hidden="true">
        <div className="site-sh-line">
          <div className="site-sh-top">
            <span className="site-sh-name">
              <span className="site-sh-off">{PIECE.filming}</span>
              <span className="site-sh-on">{PIECE.filmingMine}</span>
            </span>
            {combos.map((c) => (
              <b key={c.key} className="site-sh-num" data-c={c.key}>
                {hrs(captureHours(c.k, c.m))}
              </b>
            ))}
          </div>
          <div className="site-sh-track">
            <div className="site-sh-fill site-sh-cap" />
          </div>
          {combos.map((c) => (
            <div key={c.key} className="site-sh-sub" data-c={c.key}>
              {days(shootDays(c.k, c.m))}
            </div>
          ))}
        </div>
        <div className="site-sh-line site-sh-story-line">
          <div className="site-sh-top">
            <span className="site-sh-name">{PIECE.story}</span>
            {MINUTES.map((m) => (
              <b key={m} className="site-sh-num" data-m={m}>
                {hrs(storyHours(m))}
              </b>
            ))}
          </div>
          <div className="site-sh-track">
            <div className="site-sh-fill site-sh-story" />
          </div>
          <div className="site-sh-sub">{PIECE.storySub}</div>
        </div>
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
      {/* role="list": WebKit drops list semantics from a styled list */}
      <ul className="site-sh-steps" role="list">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <p className="site-sh-ref">
        {REFERENCE.text}{" "}
        <a className="site-link" href={REFERENCE.href} target="_blank" rel="noopener noreferrer">
          {REFERENCE.label}
        </a>
      </p>
      <p className="site-sh-close">{PIECE.close}</p>
    </div>
  )
}
