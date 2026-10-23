// The words the quote screens show: labels and notes ONLY, never a price.
// Safe to hand to the browser. Built from constants.ts so names stay in one place.
import { KINDS, QUALITY, DEADLINES, HANDLES } from "./constants"

export type Choice = { id: string; label: string; note?: string }
export type Vocab = {
  kinds: (Choice & { shootDays: number })[]
  qualities: Choice[]
  deadlines: Choice[]
  handles: (Choice & { defaultOn: boolean })[]
}

export function vocab(): Vocab {
  return {
    kinds: Object.entries(KINDS).map(([id, k]) => ({ id, label: k.label, note: k.note, shootDays: k.shootDays })),
    qualities: Object.entries(QUALITY).map(([id, q]) => ({ id, label: q.label, note: q.note })),
    deadlines: Object.entries(DEADLINES).map(([id, d]) => ({ id, label: d.label, note: d.note })),
    handles: Object.entries(HANDLES).map(([id, h]) => ({ id, label: h.label, defaultOn: h.defaultOn })),
  }
}
