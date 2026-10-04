// The pure half of support reports (SPEC §29 v2): what a report may keep. No database here, so it's unit-tested
// (store.test.ts) and lib/support/store.ts does the storing. Everything a report carries is UNTRUSTED: capped,
// redacted, enum'd; only lib/support/safety.ts's summary ever leaves the server.
import { createHmac } from "crypto"
import { ERROR_KINDS, redact, routeTemplate } from "./safety"

/** Checked from Content-Length before a body is parsed. */
export const MAX_BODY = 1_500_000
export const MAX_SHOT = 1_000_000
export const MAX_WORDS = 2000

/** What an address is counted under: an IPv4 as itself; an IPv6 by its /64, written out in full first (a home or a
 *  phone network hands out many addresses inside one /64, and "2001:db8::1" and "2001:db8:0:0:ffff::2" share one);
 *  an IPv4-mapped IPv6 as its IPv4. Anything unparseable counts as itself. */
export function ipKey(ip: string): string {
  const s = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  if (!s.includes(":")) return s
  if (s.includes(".")) return s.slice(s.lastIndexOf(":") + 1)
  const halves = s.split("::")
  if (halves.length > 2) return s
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const fill = halves.length === 2 ? Array<string>(Math.max(0, 8 - head.length - tail.length)).fill("0") : []
  const groups = [...head, ...fill, ...tail]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return s
  return groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":") + "::/64"
}

/** An address for limits only: HMAC of the last-hop IP's key (above), never the IP itself. */
export function ipHash(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHmac("sha256", process.env.SESSION_JWT_SECRET || "osc-support").update(ipKey(ip)).digest("hex").slice(0, 32)
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? redact(s.replace(/\s+/g, " ").trim()).slice(0, n) : "")
const int = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : null)
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])

/** What the browser sent about the page, made safe to keep: numbers, enums, templates, short redacted text, caps. */
export function cleanContext(raw: unknown, onClientHost: boolean) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const vp = (r.viewport && typeof r.viewport === "object" ? r.viewport : {}) as Record<string, unknown>
  const errors = (Array.isArray(r.errors) ? r.errors : []).slice(-20).map((e) => {
    const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>
    const kind = (ERROR_KINDS as readonly string[]).includes(String(x.kind)) ? String(x.kind) : "js_error"
    return { kind, msg: clip(x.msg, 300), at: int(x.at, 4_102_444_800_000) }
  })
  const failed = (Array.isArray(r.failed) ? r.failed : []).slice(-20).map((f) => {
    const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>
    const status = int(x.status, 999)
    return {
      method: METHODS.has(String(x.method).toUpperCase()) ? String(x.method).toUpperCase() : "GET",
      route: routeTemplate(x.path, onClientHost),
      status,
      at: int(x.at, 4_102_444_800_000),
    }
  })
  return {
    viewport: { w: int(vp.w, 9999), h: int(vp.h, 9999), dpr: typeof vp.dpr === "number" ? Math.min(8, Math.max(0, vp.dpr)) : null },
    scheme: r.scheme === "dark" || r.scheme === "light" ? r.scheme : null,
    online: typeof r.online === "boolean" ? r.online : null,
    errors,
    failed,
  }
}

/** A screenshot is a JPEG data URL ≤ 1 MB with JPEG magic bytes; anything else is dropped (the report still goes). */
export function decodeScreenshot(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/jpeg;base64,")) return null
  const b64 = dataUrl.slice("data:image/jpeg;base64,".length)
  if (b64.length > Math.ceil((MAX_SHOT * 4) / 3) + 8 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null
  const buf = Buffer.from(b64, "base64")
  if (buf.length < 4 || buf.length > MAX_SHOT || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null
  return buf
}

/** The client's words, as kept: trimmed, redacted, capped. "" means nothing to report. */
export const cleanWords = (message: unknown) => (typeof message === "string" ? redact(message.trim()).slice(0, MAX_WORDS) : "")

const LIMITS = { personHour: 5, personDay: 20, ipHour: 10, signedOutIpHour: 3, signedOutDay: 20, globalDay: 200 }

/** Over any cap? The counts come from inside the store's lock (lib/support/store.ts). */
export function overLimits(c: { signedOut: boolean; personHour: number; personDay: number; ipHour: number; outDay: number; allDay: number }) {
  return c.signedOut
    ? c.ipHour >= LIMITS.signedOutIpHour || c.outDay >= LIMITS.signedOutDay || c.allDay >= LIMITS.globalDay
    : c.personHour >= LIMITS.personHour || c.personDay >= LIMITS.personDay || c.ipHour >= LIMITS.ipHour || c.allDay >= LIMITS.globalDay
}
