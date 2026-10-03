// Script timing (client-website SPEC §14 "Timing", v1 = words ÷ pace). THE implementation: the editor's live
// clock, the server's render (hub, prompter, PDF) and every export use this module; nothing re-implements it.
// It must reproduce every case in ./timing.vectors.json, which scripts/script_timing.py (the reference) makes from
// hand-checked lines and the real Harmon and Gex scripts. Test: `node --test lib/scripts/timing.test.mjs`.
//
// Rules (same words as the reference): the AUDIO column only; a hyphenated word counts once, an em dash splits;
// anything in ( ) or [ ] is never read, nor are SUPER:/SFX:/MUSIC: tracks or speaker labels; numbers as spoken;
// "$___" is a blank (2 words, flagged); "(beat)" +1 s, "(pause)" +1.5 s, each "…" +0.5 s; a row's time is the
// larger of its read time and its VIDEO hold; a row with neither has no time.
//
// Written with erasable TypeScript only (Node strips the types to run the test) and no regex lookbehind (older
// iPhones can't parse it, and this runs in the browser).

export const DEFAULT_WPM = 150
export const SPOT_READ_WPM = 165
const PAUSES: Record<string, number> = { beat: 1.0, pause: 1.5 }
const ELLIPSIS_S = 0.5
const NON_SPOKEN = new Set(["SUPER", "SFX", "MUSIC"])

export type TextTiming = { words: number; pauses_s: number; blanks: number }
export type TimedRow = { words: number; seconds: number | null }
export type ScriptTiming = { rows: TimedRow[]; words: number; blanks: number; untimed_rows: number; total_s: number }
export type TimingRowInput = { audio?: { text?: string | null }[] | null; hold_s?: number | null }

const round3 = (x: number) => Math.round(x * 1000) / 1000

function wordsUnder1000(n: number): number {
  let w = 0
  if (n >= 100) {
    w += 2 // "one hundred"
    n %= 100
  }
  if (n === 0) return w
  return w + (n < 20 || n % 10 === 0 ? 1 : 2)
}

function numberWordsSmall(n: number): number {
  return n < 1000 ? wordsUnder1000(n) : numberWords(n)
}

/** Spoken English words for a whole number (American, no "and"). */
export function numberWords(n: number): number {
  if (n === 0) return 1
  let w = 0
  for (const scale of [1e12, 1e9, 1e6, 1e3]) {
    if (n >= scale) {
      w += numberWordsSmall(Math.floor(n / scale)) + 1
      n %= scale
    }
  }
  if (n) w += wordsUnder1000(n)
  return w
}

function yearWords(y: number): number {
  if (y % 1000 === 0 && y < 3000) return 2 // "two thousand"
  if (y > 2000 && y < 2010) return 2 + wordsUnder1000(y - 2000) // "two thousand five"
  const hi = Math.floor(y / 100)
  const lo = y % 100
  if (lo === 0) return wordsUnder1000(hi) + 1 // "nineteen hundred"
  const loWords = lo < 10 ? 2 : wordsUnder1000(lo) // "oh five" / "twenty six"
  return wordsUnder1000(hi) + loWords
}

function decimalWords(s: string): number {
  const clean = s.replace(/,/g, "")
  const dot = clean.indexOf(".")
  const whole = dot === -1 ? clean : clean.slice(0, dot)
  const frac = dot === -1 ? "" : clean.slice(dot + 1)
  let w = whole ? numberWords(parseInt(whole, 10)) : 1
  if (frac) w += 1 + frac.length // "point" + digits
  return w
}

// Order matters: each pattern consumes its text before the next looks. No /u flag: ASCII \b \d \w, like the
// reference (which compiles with re.ASCII).
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9-]+)\.(com|org|net|gov|edu|us|co|io|tv)\b/gi
const MONEY = /\$(_{2,}|\d[\d,]*(?:\.\d+)?)\s*(M|K|B|million|billion|thousand)?\b/gi
const TIME = /\b(\d{1,2}):(\d{2})\b/g
const RANGE = /\b(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\b/g
const PERCENT = /\b(\d[\d,]*(?:\.\d+)?)%/g
const ORDINAL = /\b(\d[\d,]*)(st|nd|rd|th)\b/gi
const YEAR = /\b(1[1-9]\d\d|20\d\d)\b/g
const NUMBER = /\b\d[\d,]*(?:\.\d+)?\b/g
const WORD = /[A-Za-z0-9_’']+(?:[-’'][A-Za-z0-9_]+)*/g
const BRACKETS = /\([^()]*\)|\[[^\[\]]*\]/g
const ELLIPSIS = /…|\.\.\./g
// A label is ALL CAPS ("NARRATOR:", "SUPER:", "MIKE (O/C):") or a name carrying a delivery mark ("Maria (O/C):").
// A plain capitalised word before a colon ("Remember: vote") is ordinary copy and is counted.
const LABEL =
  /(^|\s)((?:[A-Z][A-Z.'\-]+(?: [A-Z][A-Z.'\-]+)*(?: \((?:O\/C|VO|OC|V\.O\.|O\.C\.)\))?)|(?:[A-Z][a-z]+(?: [A-Z][a-z]+)? \((?:O\/C|VO|OC|V\.O\.|O\.C\.)\))):(?=\s|$)/g

/** Drop SUPER:/SFX:/MUSIC: segments (up to the next label); keep speakers' words, drop their labels. */
function stripTracks(text: string): string {
  const out: string[] = []
  let keep = true
  let pos = 0
  for (const m of text.matchAll(LABEL)) {
    const labelStart = (m.index ?? 0) + m[1].length
    if (keep) out.push(text.slice(pos, labelStart))
    keep = !NON_SPOKEN.has(m[2].trim().toUpperCase())
    pos = (m.index ?? 0) + m[0].length
  }
  if (keep) out.push(text.slice(pos))
  return out.join(" ")
}

/** Words, pause seconds and blanks for one AUDIO text. */
export function timeText(text: string): TextTiming {
  // Markdown bold (**) only: underscores are the client's blanks ("$___"), never formatting. Every Unicode space
  // becomes a plain space first, so this and the reference agree on what \s means.
  let t = text.replace(/\*\*/g, "").replace(/\s/g, " ")
  let words = 0
  let blanks = 0
  let pauses = 0

  // Phone numbers first: "(859) 512-1419" is read, not a direction.
  t = t.replace(PHONE, (m) => {
    words += m.replace(/\D/g, "").length
    return " "
  })
  // Labels before brackets: "Maria (O/C):" is a label only while its "(O/C)" is still there.
  t = stripTracks(t)
  // Pauses and directions: "(beat)" etc. add time; anything else in ( ) or [ ] is never read.
  t = t.replace(BRACKETS, (m) => {
    pauses += PAUSES[m.slice(1, -1).trim().toLowerCase()] ?? 0
    return " "
  })

  const ellipses = t.match(ELLIPSIS)
  pauses += (ellipses ? ellipses.length : 0) * ELLIPSIS_S
  t = t.replace(ELLIPSIS, " ")

  t = t.replace(URL_RE, (_m, label: string) => {
    words += Math.ceil(label.length / 5) + 2
    return " "
  })
  t = t.replace(MONEY, (_m, amount: string, scale: string | undefined) => {
    if (amount.startsWith("_")) {
      blanks += 1
      words += 1 // the unknown number
    } else {
      words += decimalWords(amount)
    }
    words += (scale ? 1 : 0) + 1 // "million" + "dollars"
    return " "
  })
  t = t.replace(TIME, (_m, h: string, mi: string) => {
    const minutes = parseInt(mi, 10)
    words += numberWords(parseInt(h, 10)) + (minutes === 0 ? 1 : minutes < 10 ? 2 : wordsUnder1000(minutes))
    return " "
  })
  t = t.replace(RANGE, (_m, a: string, b: string) => {
    words += decimalWords(a) + 1 + decimalWords(b) // "ten to fifteen"
    return " "
  })
  t = t.replace(PERCENT, (_m, n: string) => {
    words += decimalWords(n) + 1
    return " "
  })
  t = t.replace(ORDINAL, (_m, n: string) => {
    words += numberWords(parseInt(n.replace(/,/g, ""), 10))
    return " "
  })
  t = t.replace(YEAR, (_m, y: string) => {
    words += yearWords(parseInt(y, 10))
    return " "
  })
  t = t.replace(NUMBER, (m) => {
    words += decimalWords(m)
    return " "
  })

  t = t.replace(/—/g, " ").replace(/–/g, " ")
  const found = t.match(WORD)
  words += found ? found.length : 0
  return { words, pauses_s: round3(pauses), blanks }
}

/** Per-row seconds (null = no time set) and the script's total. */
export function timeRows(rows: TimingRowInput[], wpm: number = DEFAULT_WPM): ScriptTiming {
  const out: TimedRow[] = []
  let total = 0
  let words = 0
  let blanks = 0
  let untimed = 0
  for (const r of rows) {
    let w = 0
    let p = 0
    let b = 0
    for (const a of r.audio ?? []) {
      const x = timeText(a?.text ?? "")
      w += x.words
      p += x.pauses_s
      b += x.blanks
    }
    const read = w || p ? (w / wpm) * 60 + p : null
    const hold = r.hold_s ?? null
    const secs = read !== null || hold ? Math.max(read ?? 0, hold ?? 0) : null
    if (secs === null) untimed += 1
    else total += secs
    words += w
    blanks += b
    out.push({ words: w, seconds: secs === null ? null : round3(secs) })
  }
  return { rows: out, words, blanks, untimed_rows: untimed, total_s: round3(total) }
}

/** m:ss, rounded to the nearest second. */
export function clock(seconds: number): string {
  const s = Math.floor(seconds + 0.5)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** "0:28 of :30", "0:34 of :30 · 4 s over", "0:57 · no target set", "about 0:52 of 1:00 · 2 blanks". */
export function timingLabel(totalS: number, targetS: number | null | undefined, blanks = 0): string {
  const prefix = blanks ? "about " : ""
  const tail = blanks ? ` · ${blanks} blank${blanks !== 1 ? "s" : ""}` : ""
  if (!targetS) return `${prefix}${clock(totalS)} · no target set${tail}`
  const over = Math.floor(totalS + 0.5) - targetS
  const tgt = targetS < 60 ? `:${String(targetS).padStart(2, "0")}` : clock(targetS)
  return `${prefix}${clock(totalS)} of ${tgt}${over > 0 ? ` · ${over} s over` : ""}${tail}`
}
