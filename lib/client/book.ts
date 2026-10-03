// The client BOOK: one JSON file per client organization, kept in Dropbox at
//   {DROPBOX_ROOT_PREFIX}/_admin/client-site/books/<org-slug>.json
// It holds exactly what that client may see, written in client language.
// THE BOOK IS THE ALLOWLIST: if a fact or a file is not in the book, no client
// page can show it. lib/client/sync.ts upserts books into Postgres.
import { z } from "zod"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
const https = z.string().url().refine((u) => u.startsWith("https://"), "must be an https:// link")
const key = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase-kebab key")

export const PHASES = ["quote", "agreement", "prep", "shoot", "review", "delivered", "paid"] as const
export type Phase = (typeof PHASES)[number]

const Person = z.object({
  email: z.string().email(),
  name: z.string(),
  first_name: z.string().optional(),
  title: z.string().optional(),
  // Default VIEWER (10/3 design review): a person a book doesn't give a role gets nothing extra.
  role: z.enum(["OWNER", "APPROVER", "BILLING", "VIEWER"]).default("VIEWER"),
})

// A download is either a link we already sent (url) or a file in Dropbox
// (path, root-relative). Path downloads go through /client/download/... which
// checks the session and hands back a short-lived Dropbox link.
const Download = z
  .object({
    label: z.string(), // "Web (H.264, 1080p)"
    url: https.optional(),
    path: z.string().optional(),
    size: z.string().optional(), // "563 MB"
    note: z.string().optional(),
  })
  .refine((x) => x.url || x.path, "a download needs url or path")

const Film = z.object({
  key,
  title: z.string(),
  version: z.string().optional(),
  duration_s: z.number().int().positive().optional(),
  delivered_on: date.optional(),
  mux_playback_id: z.string().optional(),
  poster_time: z.number().optional(),
  file: z.string().optional(), // Dropbox path to a browser-playable MP4 (plays in place)
  poster: z.string().optional(), // Dropbox path or /public path to a still
  aspect: z.string().optional(), // "16/9" (default), "1820/580"
  watch_url: https.optional(),
  review_url: https.optional(),
  downloads: z.array(Download).default([]),
  description: z.string().optional(),
})

const Shoot = z.object({
  key,
  label: z.string().optional(),
  start: date,
  end: date.optional(),
  call_time: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  bring: z.string().optional(),
})

const Project = z.object({
  key,
  slug: key,
  job_number: z.string().optional(),
  title: z.string(),
  kind: z.string().optional(), // "Brand film", "Fundraising film"
  summary: z.string().optional(),
  status_line: z.string().optional(),
  next_step: z.string().optional(),
  phase: z.enum(PHASES),
  poster: z
    .object({ mux_playback_id: z.string().optional(), time: z.number().optional(), path: z.string().optional() })
    .optional(),
  dates: z.array(z.object({ label: z.string(), date, note: z.string().optional() })).default([]),
  team: z.array(z.object({ name: z.string(), role: z.string() })).default([]),
  sort_date: date.optional(),
  films: z.array(Film).default([]),
  shoots: z.array(Shoot).default([]),
})

const Invoice = z.object({
  number: z.string(),
  project_key: key.optional(),
  title: z.string(),
  amount: z.number().nonnegative(),
  issued_on: date,
  due_on: date.optional(),
  paid_on: date.optional(),
  status: z.enum(["open", "paid", "void"]),
  pay_url: https.optional(),
  pdf: z.string().optional(), // Dropbox path, root-relative ("/Clients/...")
  memo: z.string().optional(),
})

const Document = z.object({
  key,
  project_key: key.optional(),
  kind: z.enum([
    "agreement", "proposal", "release", "call-sheet", "license", "invoice", "receipt", "w9", "coi", "brief", "other",
  ]),
  title: z.string(),
  description: z.string().optional(),
  dated_on: date.optional(),
  path: z.string().optional(), // Dropbox path, root-relative
  url: https.optional(),
  signed_by: z.string().optional(),
  signed_on: date.optional(),
})

export const Book = z.object({
  version: z.literal(1),
  org: z.object({
    slug: key,
    name: z.string(),
    short_name: z.string().optional(),
    logo: z.string().optional(), // /client-logos/x.png (public) or a Dropbox path
    website: z.string().optional(),
    billing_email: z.string().email().optional(),
  }),
  people: z.array(Person).default([]),
  projects: z.array(Project).default([]),
  invoices: z.array(Invoice).default([]),
  documents: z.array(Document).default([]),
})

export type Book = z.infer<typeof Book>
export type BookProject = z.infer<typeof Project>
export type BookFilm = z.infer<typeof Film>
export type BookDownload = z.infer<typeof Download>
