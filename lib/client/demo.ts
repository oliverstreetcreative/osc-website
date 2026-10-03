// THE DEMO CLIENT (SPEC §19 v2; Sam 10/3 08:50: "a demo link for a client portal to show Jesse").
// A fictional org that exists ONLY on staging while CLIENT_DEMO_TOKEN is set: Fernwood Community Foundation, one
// person (Dana Whitfield, on the reserved .example domain, which can never receive mail), two projects, invoices,
// three sample documents and an upcoming shoot day. Films are our own public /work films under their REAL titles,
// labelled "sample film". Dates are computed from today, so the demo never goes stale.
//
// Safety, in one place:
//   - demoOn() (staging + the env var) is the ONE switch: it applies the book, keeps the org visible and lets
//     demo sessions in (middleware checks the same thing with Web Crypto; see demoFingerprintEdge there).
//   - Every link in the book is the inert placeholder and every file path sits in the demo folder; demoBook()
//     refuses to build otherwise. Pages show "Off in the demo" on every button backed by a link.
import { createHash, timingSafeEqual } from "crypto"
import { Book } from "./book"
import { WORK_VIDEOS } from "@/lib/work-videos"
import { IS_STAGING } from "@/lib/site-env"

export const DEMO_ORG_SLUG = "demo-fernwood"
export const DEMO_EMAIL = "dana@fernwood.example"
export const DEMO_TTL_SECONDS = 8 * 3600
export const DEMO_TOKEN_MIN = 32
/** The only URL any demo link field may hold. It is never rendered as a link for the demo org. */
export const DEMO_LINK = "https://oliverstreetcreative.com/"
/** Where the demo's sample PDFs live in Dropbox (root-relative, like every book path). */
export const DEMO_DOCS = "/_admin/client-site/demo/fernwood"

/** A slug that belongs to a demo org. Real books may never use the prefix (sync refuses them). */
export const isDemoSlug = (slug: string | null | undefined) => !!slug && slug.startsWith("demo-")

function token(): string | null {
  const t = process.env.CLIENT_DEMO_TOKEN?.trim() ?? ""
  return t.length >= DEMO_TOKEN_MIN && /^[A-Za-z0-9_-]+$/.test(t) ? t : null
}

/** THE switch: staging, and a demo token is configured. */
export function demoOn(): boolean {
  return IS_STAGING && token() !== null
}

const sha256 = (s: string) => createHash("sha256").update(s).digest()

/** First 16 hex characters of sha256(token): what a demo session carries, so rotating the token ends it. */
export function demoFingerprint(): string | null {
  const t = token()
  return t ? sha256(t).toString("hex").slice(0, 16) : null
}

/** Constant-time check of the token in a demo link (sha256 against sha256, so lengths always match). */
export function demoTokenMatches(candidate: string): boolean {
  const t = token()
  if (!IS_STAGING || !t) return false
  return timingSafeEqual(sha256(candidate), sha256(t))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
function dayFrom(today: Date, n: number) {
  return iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n, 12)))
}

/** Every URL is the placeholder and every path is in the demo folder, or the book is refused. */
function assertInert(book: Book) {
  const bad: string[] = []
  const url = (u: string | undefined, where: string) => {
    if (u !== undefined && u !== DEMO_LINK) bad.push(`${where}: ${u}`)
  }
  const path = (p: string | undefined, where: string) => {
    if (p !== undefined && !p.startsWith(`${DEMO_DOCS}/`)) bad.push(`${where}: ${p}`)
  }
  const muxIds = new Set(WORK_VIDEOS.map((v) => v.playbackId))
  if (book.org.logo !== undefined || book.org.website !== undefined) bad.push("org: no logo or website in the demo")
  for (const p of book.projects) {
    if (p.poster?.path !== undefined) bad.push(`${p.key}: poster path`)
    if (p.poster?.mux_playback_id !== undefined && !muxIds.has(p.poster.mux_playback_id)) bad.push(`${p.key}: poster mux id`)
    for (const f of p.films) {
      url(f.watch_url, `${p.key}/${f.key} watch_url`)
      url(f.review_url, `${p.key}/${f.key} review_url`)
      if (f.file !== undefined || f.poster !== undefined) bad.push(`${p.key}/${f.key}: no Dropbox media in the demo`)
      if (f.mux_playback_id !== undefined && !muxIds.has(f.mux_playback_id)) bad.push(`${p.key}/${f.key}: mux id not a /work film`)
      for (const d of f.downloads) {
        url(d.url, `${p.key}/${f.key} download`)
        if (d.path !== undefined) bad.push(`${p.key}/${f.key}: download path`)
      }
    }
  }
  for (const i of book.invoices) {
    url(i.pay_url, `invoice ${i.number} pay_url`)
    if (i.pdf !== undefined) bad.push(`invoice ${i.number}: pdf`)
  }
  for (const d of book.documents) {
    url(d.url, `document ${d.key} url`)
    path(d.path, `document ${d.key} path`)
  }
  if (bad.length) throw new Error(`demo book refused (a link isn't inert): ${bad.join("; ")}`)
}

/** The demo book, dated from `today`. Parsed with the same zod schema as every real client's book. */
export function demoBook(today = new Date()): Book {
  const at = (n: number) => dayFrom(today, n)
  const film = (slug: string) => {
    const v = WORK_VIDEOS.find((w) => w.slug === slug)
    if (!v) throw new Error(`demo: the /work film ${slug} is gone`)
    return v
  }
  const report = film("boone-county-2025")
  const gala = film("phoenixs-story")
  // Sam's own OSC line and address (public, OSC's): the demo shows the team card's icons.
  const team = [
    { id: "sam", name: "Sam Patton", role: "Producer and director", phone: "+18595121419", mobile: true, email: "sam@oliverstreetcreative.com" },
  ]
  const book = Book.parse({
    version: 1,
    org: { slug: DEMO_ORG_SLUG, name: "Fernwood Community Foundation", short_name: "Fernwood" },
    people: [
      { email: DEMO_EMAIL, name: "Dana Whitfield", first_name: "Dana", title: "Communications Director", role: "OWNER" },
    ],
    projects: [
      {
        key: "year-end-report",
        slug: "year-end-report",
        title: "2025 Year-End Report",
        kind: "Report film",
        summary: "Your year in the words of the people who lived it: three families and two board members.",
        status_line: "Cut 2 is ready for your notes.",
        next_step: "Watch it and leave your notes. We lock picture after this round.",
        phase: "review",
        dates: [
          { label: "Notes due", date: at(4) },
          { label: "Pickup interview", date: at(9) },
          { label: "Final delivery", date: at(21) },
        ],
        team,
        sort_date: at(-2),
        films: [
          {
            key: "report-cut-2",
            title: report.title,
            version: "Cut 2 · sample film",
            duration_s: 245,
            mux_playback_id: report.playbackId,
            poster_time: report.thumbTime,
            review_url: DEMO_LINK,
            description: `Sample film: our ${report.title} for the ${report.clientName}, standing in for a cut in review.`,
          },
        ],
        shoots: [
          {
            key: "pickup",
            label: "Pickup interview with the board chair",
            start: at(9),
            call_time: "9:00 AM",
            location: "Fernwood Community Center",
          },
        ],
      },
      {
        key: "spring-gala",
        slug: "spring-gala",
        title: "Spring Gala Story Film",
        kind: "Fundraising film",
        summary: "One family's story, premiered at the spring gala.",
        status_line: "Delivered. Thank you.",
        phase: "delivered",
        team,
        sort_date: at(-55),
        films: [
          {
            key: "gala-film",
            title: gala.title,
            version: "Sample film",
            duration_s: 300,
            delivered_on: at(-55),
            mux_playback_id: gala.playbackId,
            poster_time: gala.thumbTime,
            description: `Sample film: our ${gala.title} for ${gala.clientName}, standing in for a finished delivery.`,
            downloads: [
              { label: "Web (H.264, 1080p)", url: DEMO_LINK, size: "612 MB" },
              { label: "Broadcast (ProRes 422 HQ)", url: DEMO_LINK, size: "8.4 GB" },
            ],
          },
        ],
      },
    ],
    invoices: [
      { number: "DEMO-0981", project_key: "spring-gala", title: "Spring Gala Story Film · booking (50%)", amount: 2400, issued_on: at(-130), paid_on: at(-126), status: "paid" },
      { number: "DEMO-0994", project_key: "spring-gala", title: "Spring Gala Story Film · balance at delivery", amount: 2400, issued_on: at(-55), paid_on: at(-52), status: "paid" },
      { number: "DEMO-1004", project_key: "year-end-report", title: "2025 Year-End Report · booking (50%)", amount: 3250, issued_on: at(-44), paid_on: at(-41), status: "paid" },
      {
        number: "DEMO-1007", project_key: "year-end-report", title: "2025 Year-End Report · balance at cut 2 (50%)",
        amount: 3250, issued_on: at(-2), due_on: at(12), status: "open", pay_url: DEMO_LINK,
      },
    ],
    documents: [
      {
        key: "agreement-report", project_key: "year-end-report", kind: "agreement", title: "Production Agreement (sample)",
        description: "2025 Year-End Report", dated_on: at(-46), signed_by: "Dana Whitfield", signed_on: at(-45),
        path: `${DEMO_DOCS}/Sample Production Agreement - 2025 Year-End Report.pdf`,
      },
      {
        key: "proposal-report", project_key: "year-end-report", kind: "proposal", title: "Proposal (sample)",
        description: "2025 Year-End Report", dated_on: at(-52),
        path: `${DEMO_DOCS}/Sample Proposal - 2025 Year-End Report.pdf`,
      },
      {
        key: "release-center", project_key: "year-end-report", kind: "release", title: "Location Release (sample)",
        description: "Fernwood Community Center", dated_on: at(-20), signed_by: "Dana Whitfield", signed_on: at(-20),
        path: `${DEMO_DOCS}/Sample Location Release - Fernwood Community Center.pdf`,
      },
    ],
  })
  assertInert(book)
  return book
}
