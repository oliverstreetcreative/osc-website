// Staging access uses verified OSC email links (Sam 10/11 23:20).
// Gate passes are NOT portal sessions. v2 uses the session signing key with a
// separate purpose label; old password-signed v1 cookies cannot authorize.
export const GATE_COOKIE_SECURE = "__Host-osc_gate"
/** The plain name counts ONLY on localhost (anywhere else a sibling subdomain could toss one in), like the session's. */
export const GATE_COOKIE_SHARED = "__Secure-osc_staging_gate"
export const GATE_MAGIC = "/staging-gate/magic"
export const GATE_VERIFY = "/staging-gate/verify"
export const GATE_CODE = "/staging-gate/code"
export const GATE_SIGNOUT = "/staging-gate/signout"
export const GATE_COOKIE_PLAIN = "osc_gate"
/** Readable by the page; it only SHOWS the Comment button. Set by the email verification alone (never the harness or the
 *  demo), so prospects and screenshots never see the button. The comment API itself sits behind the real pass. */
export const GATE_UI_COOKIE = "osc_gate_ui"
export const GATE_PAGE = "/staging-gate"
export const GATE_ENTER = "/staging-gate/enter"
export const SIGNING_KEY_MIN = 32
export const PASS_SECONDS = 30 * 86400
export const PREVIEW_PASS_SECONDS = 12 * 3600
const MAX_AHEAD = PASS_SECONDS + 86400
const LABEL = "osc-staging-gate:v2|"
const enc = new TextEncoder()

export const nowSeconds = () => Math.floor(Date.now() / 1000)

export function signingKeyUsable(raw: string | null | undefined): string | null {
  return typeof raw === "string" && raw.trim().length >= SIGNING_KEY_MIN ? raw : null
}
export function gateKey(): string | null {
  return signingKeyUsable(process.env.SESSION_JWT_SECRET)
}

/** Exact corporate domain, not lookalikes, display names or subdomains. */
export function stagingEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  const parts = email.split("@")
  if (email.length > 254 || parts.length !== 2 || parts[1] !== "oliverstreetcreative.com") return null
  if (!/^[a-z0-9.!#$%&'*+\/=?^_\x60{|}~-]{1,64}$/.test(parts[0]) || parts[0].startsWith(".") || parts[0].endsWith(".") || parts[0].includes("..")) return null
  return email
}
export function stagingCookieDomain(host: string): string | undefined {
  const h = host.split(":")[0].toLowerCase()
  return h === "staging.oliverstreetcreative.com" || h.endsWith(".staging.oliverstreetcreative.com")
    ? ".staging.oliverstreetcreative.com" : undefined
}

function b64url(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=")
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const hmacKey = (key: string) =>
  crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])

/** A pass good until `exp` (unix seconds). */
export async function makePass(key: string, exp: number): Promise<string> {
  const e = String(Math.floor(exp))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(key), enc.encode(LABEL + e))
  return `v2.${e}.${b64url(new Uint8Array(sig))}`
}

/** True when `pass` was made with this signing key and hasn't expired. The signature check is WebCrypto's verify
 *  (constant time); an expiry further out than any pass is ever given is refused too. */
export async function passValid(pass: string | null | undefined, key: string, now: number): Promise<boolean> {
  if (!pass || pass.length > 80) return false
  const m = /^v2\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(pass)
  if (!m) return false
  const exp = Number(m[1])
  if (!(exp > now) || exp > now + MAX_AHEAD) return false
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(key), fromB64url(m[2]), enc.encode(LABEL + m[1]))
  } catch {
    return false
  }
}

/** Where to go after email verification: a path on THIS site, or "/". Never `//host` or `/\host` (a browser reads both as
 *  another site), never a control character or backslash, never the gate itself. Callers build the redirect on the
 *  site's public origin, so the host can't change either way. */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 2000) return "/"
  if (raw.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(raw)) return "/"
  if (raw === GATE_PAGE || raw.startsWith(`${GATE_PAGE}/`) || raw.startsWith(`${GATE_PAGE}?`)) return "/"
  return raw
}

/**
 * The requests that never need a pass, by exact path AND method (SPEC §32 v2). Written fresh on purpose: the site's
 * public-path lists open `/api/auth/*`, `/magic` and `/f/*`, which staging keeps behind the gate.
 *   "gate"  the gate's own page and form (served as they are: no host routing)
 *   "open"  robots.txt; the hub's script render (its own key); the screenshot harness's sign-in (its own key; it
 *           sets a 12-hour pass); a demo link (its own secret); a private calendar feed (its token is the key, and a
 *           calendar app can't sign in interactively)
 *   "demo"  the client pages and their logos, for a VALID demo session only (prospects never meet the gate)
 */
export type GateExemption = "gate" | "open" | "demo" | null
export function gateExemption(path: string, method: string): GateExemption {
  const read = method === "GET" || method === "HEAD"
  if (path === GATE_PAGE && read) return "gate"
  if (path === GATE_ENTER && method === "POST") return "gate"
  if (path === GATE_MAGIC && read) return "gate"
  if ([GATE_VERIFY, GATE_CODE, GATE_SIGNOUT].includes(path) && method === "POST") return "gate"
  if (path === "/robots.txt" && read) return "open"
  if (method === "GET" && /^\/api\/scripts\/[0-9a-f-]{36}\/render$/i.test(path)) return "open"
  if (method === "GET" && path === "/api/auth/preview") return "open"
  if (method === "GET" && /^\/demo\/[^/]{1,300}$/.test(path)) return "open"
  if (read && /^\/calendar\/[^/]{1,300}$/.test(path)) return "open"
  if (path === "/client" || path.startsWith("/client/") || path.startsWith("/client-logos/")) return "demo"
  return null
}

/** A request WITHOUT a pass: a page read shows the gate (status 200, the address kept); so does a browser OPENING an
 *  /api link (Sec-Fetch-Mode: navigate, e.g. the quote desk's unlock link), so it lands there after email verification.
 *  Anything else (a fetch, a write) is refused. */
export function withoutPass(path: string, method: string, navigate = false): "gate-page" | "refuse" {
  if (method !== "GET" && method !== "HEAD") return "refuse"
  return navigate || (path !== "/api" && !path.startsWith("/api/")) ? "gate-page" : "refuse"
}

/** One cookie's value from a Cookie header. */
export function cookieFrom(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

const hostOf = (h: Headers) => (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].split(":")[0].trim().toLowerCase()

/** For the routes middleware never sees (the brand-asset upload): does this request carry a valid pass? False when
 *  staging has no signing key (closed). */
export async function requestHasPass(headers: Headers, now = nowSeconds()): Promise<boolean> {
  const key = gateKey()
  if (!key) return false
  const local = ["localhost", "127.0.0.1"].includes(hostOf(headers))
  const cookie = headers.get("cookie")
  const pass = (stagingCookieDomain(hostOf(headers)) ? cookieFrom(cookie, GATE_COOKIE_SHARED) : undefined) ?? cookieFrom(cookie, GATE_COOKIE_SECURE) ?? (local ? cookieFrom(cookie, GATE_COOKIE_PLAIN) : undefined)
  return passValid(pass, key, now)
}

/** The pass cookie's name and attributes for a response (Node routes). `__Host-` needs Secure, Path=/ and no Domain. */
export function passCookie(secure: boolean, seconds: number, host = "") {
  const domain = secure ? stagingCookieDomain(host) : undefined
  return {
    name: secure ? (domain ? GATE_COOKIE_SHARED : GATE_COOKIE_SECURE) : GATE_COOKIE_PLAIN,
    options: { path: "/", httpOnly: true, secure, sameSite: "lax" as const, maxAge: seconds, ...(domain ? { domain } : {}) },
  }
}

/** Separate headers preserve BOTH old host-only and shared UI cookies at sign-out. */
export function gateCookieExpirations(host: string, secure: boolean): string[] {
  const pairs: Array<[string, string | undefined]> = [[GATE_COOKIE_SECURE, undefined], [GATE_COOKIE_PLAIN, undefined], [GATE_UI_COOKIE, undefined]]
  const domain = secure ? stagingCookieDomain(host) : undefined
  if (domain) pairs.push([GATE_COOKIE_SHARED, domain], [GATE_UI_COOKIE, domain])
  return pairs.map(([name, scope]) => `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}${name === GATE_UI_COOKIE ? "" : "; HttpOnly"}${scope ? `; Domain=${scope}` : ""}`)
}
