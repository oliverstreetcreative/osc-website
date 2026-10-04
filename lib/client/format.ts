import type { Phase } from "./book"

export const PHASE_STEPS: { key: Phase; label: string }[] = [
  { key: "quote", label: "Quote" },
  { key: "agreement", label: "Agreement" },
  { key: "prep", label: "Prep" },
  { key: "shoot", label: "Shoot" },
  { key: "review", label: "Review" },
  { key: "delivered", label: "Delivered" },
  { key: "paid", label: "Paid" },
]

export function phaseIndex(phase: string | null | undefined) {
  const i = PHASE_STEPS.findIndex((p) => p.key === phase)
  return i < 0 ? 0 : i
}
export function phaseLabel(phase: string | null | undefined) {
  return PHASE_STEPS[phaseIndex(phase)].label
}

export function money(n: number | string | { toString(): string }, cents = false) {
  const v = typeof n === "number" ? n : Number(n.toString())
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents || v % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

// Dates are stored at noon UTC (calendar dates), so format them in UTC.
export function day(d: Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!d) return ""
  return d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts })
}
/** A MOMENT (an approval, an upload) as its Eastern calendar day. `day()` is for date-only facts stored at UTC noon. */
export function dayET(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { timeZone: "America/New_York", ...opts })
}
export function dayShort(d: Date | null | undefined) {
  return day(d, { month: "short", day: "numeric" })
}

export function todayUTC() {
  const now = new Date()
  // Cincinnati is UTC-4/-5; "today" for the client is the Eastern date.
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  return new Date(Date.UTC(eastern.getFullYear(), eastern.getMonth(), eastern.getDate(), 12))
}

export function daysFromToday(d: Date) {
  return Math.round((d.getTime() - todayUTC().getTime()) / 86_400_000)
}

export function relativeDue(d: Date | null) {
  if (!d) return "Due on receipt"
  const n = daysFromToday(d)
  if (n === 0) return "Due today"
  if (n === 1) return "Due tomorrow"
  if (n > 1 && n <= 14) return `Due in ${n} days`
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} past due`
  return `Due ${day(d)}`
}

export function duration(s: number | null | undefined) {
  if (!s) return ""
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

export function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }))
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function muxThumb(playbackId: string, time?: number | null, width = 960) {
  const t = time != null ? `&time=${time}` : ""
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}${t}`
}

export const DOC_KIND_LABEL: Record<string, string> = {
  agreement: "Agreement",
  proposal: "Proposal",
  release: "Release",
  "call-sheet": "Call sheet",
  license: "License",
  invoice: "Invoice",
  receipt: "Receipt",
  w9: "W-9",
  coi: "Insurance",
  brief: "Paperwork",
  other: "File",
}
