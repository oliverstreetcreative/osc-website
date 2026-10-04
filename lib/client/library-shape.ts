// The shape of a published footage package (SPEC §23 v2) and the words around it. No database here, so tests and
// the sync share one definition. Closed schema: the gate already refused anything else; this is defence in depth.
import { z } from "zod"

const Clip = z
  .object({
    key: z.string().regex(/^[0-9a-f]{16}-\d+@\d+-\d+$/),
    sam_event: z.string().regex(/^[0-9a-f]{12}-[0-9a-f]{8}$/),
    title: z.string().min(1).max(120),
    taken_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fps: z.number().min(1).max(240),
    mux_playback_id: z.string().regex(/^[A-Za-z0-9]{10,80}$/),
    mux_asset_id: z.string().regex(/^[A-Za-z0-9]{10,80}$/),
    duration_s: z.number().positive(),
    thumb_s: z.number().min(0).optional(),
    aspect: z.string().regex(/^\d{1,4}[:/]\d{1,4}$/).optional(),
  })
  .strict()

export const Package = z
  .object({
    format: z.literal("osc-library/2"),
    org: z.string(),
    project: z.string(),
    job: z.string(),
    key: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1).max(120),
    description: z.string().max(600).optional(),
    made_by: z.string().optional(),
    made_at: z.string().optional(),
    clips: z.array(Clip).max(2000),
  })
  .strict()
export type Package = z.infer<typeof Package>

/** "Jun 12–14" / "Jun 12" / "" for a library's days (date-only facts stored at UTC noon). */
export function dayRange(first: Date | null, last: Date | null) {
  if (!first) return ""
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "UTC", ...o })
  if (!last || last.getTime() === first.getTime()) return f(first, { month: "short", day: "numeric" })
  if (first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear())
    return `${f(first, { month: "short", day: "numeric" })}–${f(last, { day: "numeric" })}`
  return `${f(first, { month: "short", day: "numeric" })} – ${f(last, { month: "short", day: "numeric" })}`
}

/** "0:14" for a clip's length. */
export const clipLength = (s: number) => {
  const t = Math.round(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}
