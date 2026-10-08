// Staging's Comment button (client-website SPEC §32 v2), the pure half: what a comment may hold and where it's filed.
// A comment is DATA typed into a web page by whoever had staging's password. It's cleaned and capped here, filed
// add-only in Dropbox (_admin/staging-comments/), and routed to the owning matter's PENDING-RULINGS.md by
// scripts/route_staging_comments.py, which holds the owners table (one place; reassigning a page needs no deploy).
import { cleanTyped } from "@/lib/client/request-form"
import { deviceOf } from "@/lib/support/safety"

export const NOTE_MAX = 4000
export const BODY_MAX = 16 * 1024
export const COMMENTS_DIR = "/_admin/staging-comments"
export const COMMENT_FORMAT = "osc-staging-comment/1"
const ZONE = "America/New_York"

/** Secrets never reach a file: sign-in links' tokens (in the query), private links' secrets (in the path), JWTs. The
 *  rest of the path stays exact (a request's id says which page Sam meant; ids aren't secrets, a session is). */
export function scrubSecrets(s: string): string {
  return s
    .replace(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, "[redacted-jwt]")
    .replace(/([?&#;](?:token|key|code|sig|signature|secret|t|access_token|password|otp)=)[^&\s#]+/gi, "$1[redacted]")
    .replace(/\/(calendar|demo|share|invite|f)\/[^\s/?#]+/gi, "/$1/[redacted]")
    .replace(/\bf\.io\/[^\s]+/gi, "f.io/[redacted]")
}

/** One line of page text (a title, a path): no controls or line breaks, runs of spaces collapsed, capped. */
function oneLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return cleanTyped(raw, max * 2).replace(/\s+/g, " ").trim().slice(0, max)
}

/** "iPhone · Safari", "Mac · Chrome": plain words for the note's header (the user agent itself is never kept). */
export function deviceWords(ua: string | null | undefined): string {
  const { device, browser, os } = deviceOf(ua)
  const what =
    os === "ios"
      ? device === "tablet"
        ? "iPad"
        : "iPhone"
      : os === "android"
        ? device === "tablet"
          ? "Android tablet"
          : "Android phone"
        : os === "macos"
          ? "Mac"
          : os === "windows"
            ? "Windows PC"
            : os === "linux"
              ? "Linux"
              : device === "unknown"
                ? "unknown device"
                : device
  const how = browser === "other" ? "another browser" : browser[0].toUpperCase() + browser.slice(1)
  return `${what} · ${how}`
}

export type Viewport = { w: number; h: number; dpr: number }
export type CommentInput = { note: string; path: string; title: string; viewport: Viewport | null }

/** The browser's JSON, checked: the note (1 to 4,000 characters, cleaned like client text), the page's path (a path
 *  on this site, secrets scrubbed), its title, and the viewport (sane numbers or nothing). */
export function parseComment(body: Record<string, unknown>): { ok: true; value: CommentInput } | { ok: false; why: string } {
  const note = typeof body.note === "string" ? scrubSecrets(cleanTyped(body.note, NOTE_MAX)) : ""
  if (!note) return { ok: false, why: "Type a note first." }
  const rawPath = typeof body.path === "string" ? body.path : ""
  if (!rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.length > 2000) return { ok: false, why: "Which page?" }
  const path = scrubSecrets(oneLine(rawPath, 500))
  const title = scrubSecrets(oneLine(body.title, 200))
  const v = body.viewport as Record<string, unknown> | null | undefined
  const num = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : null)
  const w = num(v?.w, 100, 10000)
  const h = num(v?.h, 100, 10000)
  const dpr = num(v?.dpr, 0.5, 8)
  const viewport = w !== null && h !== null && dpr !== null ? { w: Math.round(w), h: Math.round(h), dpr: Math.round(dpr * 100) / 100 } : null
  return { ok: true, value: { note, path, title, viewport } }
}

function zoned(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>
}

/** "10/8 14:02", Sam's clock (Eastern). */
export function localStamp(at: Date): string {
  const z = zoned(at)
  return `${Number(z.month)}/${Number(z.day)} ${z.hour}:${z.minute}`
}

/** Where a comment is filed (Dropbox, root-relative): one folder per Eastern day, the time first so a folder reads in
 *  order, and the id's first 8 characters so two comments in one second never collide. */
export function commentFile(at: Date, id: string): string {
  const z = zoned(at)
  return `${COMMENTS_DIR}/${z.year}-${z.month}-${z.day}/${z.hour}${z.minute}${z.second}_${id.slice(0, 8)}.json`
}

export type Who = { name: string; email: string; staff: boolean } | null

/** The file's contents. `who` is the verified session (or null); `viewing_as` the client a staff member is viewing. */
export function commentRecord(
  c: CommentInput,
  f: { id: string; at: Date; host: string; ua: string | null; build: string | null; who: Who; viewingAs: string | null },
) {
  return {
    format: COMMENT_FORMAT,
    id: f.id,
    at: f.at.toISOString(),
    at_local: localStamp(f.at),
    host: oneLine(f.host, 200),
    path: c.path,
    title: c.title,
    note: c.note,
    viewport: c.viewport,
    device: deviceWords(f.ua),
    build: f.build ? oneLine(f.build, 64) : null,
    who: f.who ? { name: oneLine(f.who.name, 120), email: oneLine(f.who.email, 200), staff: f.who.staff } : null,
    viewing_as: f.viewingAs ? oneLine(f.viewingAs, 120) : null,
  }
}
