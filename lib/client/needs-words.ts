// The words a Needs-you item uses, shared by Home's cards and a job page's list (SPEC §28 v2; review 10/6: one
// wording, so the two lists can't drift). Pure.
import { shareToken } from "./review"

/** " · Version 3" from Review's own number; a Frame.io (or demo) link keeps the book's label; otherwise nothing. */
export const cutVersion = (film: { review_url: string | null; version_label: string | null }, n?: number) =>
  n ? ` · Version ${n}` : !shareToken(film.review_url) && film.version_label ? ` · ${film.version_label}` : ""

/** When a filming day is, counted from today. */
export const shootWhen = (inDays: number) =>
  inDays < 0 ? "Happening now" : inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`

/** What a script asks of them. */
export const scriptAsk = (status: string) => (status === "ready_for_ok" ? "Ready for your OK" : "Ready for your notes")
