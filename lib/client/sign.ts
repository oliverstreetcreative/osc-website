// Signatures in the client portal: a FRONT-END on Sign Here, the one signature engine (Sam 10/3 01:05).
// Contract v2: Matters/sign-here/HANDOFF.md, "THE CONTRACT — signatures needed, v2" (v1 is retired and refuses this
// token). This module never keeps its own status: every read asks the engine (the registry is the truth).
//
// Server-to-server only (never proxied to the public), with ONE service token plus who-is-asking headers:
//   GET  {SIGN_HERE_URL}/sign/api/v2/needed/{job}         -> Summary (only the viewer's OWN client-kind paper)
//   POST {SIGN_HERE_URL}/sign/api/v2/start/{job} {item_id} -> {agreement_id, sign_url}; the ENGINE picks the template
//   GET  {SIGN_HERE_URL}/sign/api/v2/receipt/{agreement_id} -> the executed PDF, only for its signer
// Headers on every call: Authorization: Bearer <token>; X-Sign-Org: <the org's PUBLISHED book slug>;
// X-Sign-Viewer: <the signed-in person's email>, or X-Sign-Staff: 1 (staff viewing as the client: read-only, no viewer).
//
// Fail closed, visibly: with signing switched on, any non-200 (503 = "signing isn't set up for this org"), a timeout
// or a bad shape is "Paperwork unavailable right now", NEVER "all set". An empty list from a 200 is genuinely nothing
// to sign. Until SIGN_HERE_URL + SIGN_HERE_SERVICE_TOKEN are set, signing is dormant: nothing shows, nothing breaks.
//
// STAGING (SPEC §22 v2.1, Sign Here's step 8): staging's engine holds no real books, only its bundled test org. So on
// staging ONLY the signing twin asks (as that org), and a client may see their own SAMPLE paper, marked, when
// SIGN_SHOW_SAMPLES=1. Everywhere else (production, and any environment that isn't staging) a real org asks under its
// own published slug, and a client never sees a sample.
import { IS_STAGING } from "@/lib/site-env"
import { isDemoSlug } from "./demo"
import { SIGN_TWIN, isRehearsalSlug } from "./rehearsal"

export type SignKind = "talent_release" | "minor_release" | "location_release" | "client_agreement" | "crew_deal_memo"

export type SignState =
  | "missing"
  | "sent"
  | "link_expired"
  | "signed_sample"
  | "awaiting_countersign"
  | "covers_short"
  | "signed"
  | "on_file"
  | "unknown"

/** The fields of the engine's NeededSignature (v2) this portal uses. Ids are opaque: never parse them. */
export type NeededSignature = {
  id: string
  job: string
  kind: SignKind
  label?: string
  date: string | null
  days?: string[]
  who: { name: string; email?: string }
  template?: string | null
  can_start: boolean
  why_not?: string
  state?: SignState
  status: "missing" | "sent" | "signed"
  satisfied?: boolean
  agreement_id: string | null
  signed_at: string | null
  sent_at?: string | null
  link_expired?: boolean
  sample?: boolean // absent for real viewers; staff see samples, marked
  due?: string | null
  overdue?: boolean
}

type Summary = { contract: number; job: string; items: NeededSignature[]; generated_at?: string }

/** What a read returned: the items, or that the engine couldn't answer (show "unavailable", never "all set"). */
export type NeededResult = { ok: true; items: NeededSignature[] } | { ok: false }

/** Who is asking: the signed-in person, or OSC staff viewing as the client (read-only). */
export type SignViewer = { email: string } | { staff: true }

const CLIENT_KINDS: SignKind[] = ["client_agreement", "talent_release", "location_release"]

export const KIND_LABEL: Record<SignKind, string> = {
  client_agreement: "Agreement",
  talent_release: "Appearance release",
  minor_release: "Release for a minor",
  location_release: "Location release",
  crew_deal_memo: "Deal memo",
}

const base = () => process.env.SIGN_HERE_URL?.trim().replace(/\/$/, "") || ""
const token = () => process.env.SIGN_HERE_SERVICE_TOKEN?.trim() || ""
export const signingEnabled = () => Boolean(base() && token())

/**
 * The org name Sign Here is told (X-Sign-Org), or null = this org doesn't ask (no Paperwork shows). The ONE place
 * that decides; every call below goes through it.
 *   staging: ONLY the signing twin, as the engine's bundled test org (real orgs would only ever get a 503 there).
 *   anywhere else: a real org's own published slug; never a rehearsal, demo or preview org.
 */
export function signOrgFor(slug: string | null | undefined, staging = IS_STAGING): string | null {
  if (!slug || isDemoSlug(slug) || slug.endsWith("--preview")) return null
  if (staging) return slug === SIGN_TWIN.slug ? SIGN_TWIN.signOrg : null
  return isRehearsalSlug(slug) ? null : slug
}

/** Staging only: a client sees their own SAMPLE paper, marked, so the staging proof has something to sign (every form
 *  is a sample until counsel blesses it). Anywhere else a client never sees a sample, whatever the env says. */
export const showSamples = (staging = IS_STAGING) => staging && process.env.SIGN_SHOW_SAMPLES?.trim() === "1"

function headersFor(org: string, viewer: SignViewer): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token()}`, "X-Sign-Org": org }
  if ("staff" in viewer) h["X-Sign-Staff"] = "1"
  else h["X-Sign-Viewer"] = viewer.email
  return h
}

async function call(path: string, org: string, viewer: SignViewer, init: RequestInit = {}) {
  return fetch(`${base()}${path}`, {
    ...init,
    headers: { ...headersFor(org, viewer), "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
}

/** The engine's list for one job, as THIS viewer may see it. `slug` is the portal org's; the engine is told
 *  signOrgFor(slug). Null = signing is dormant, or this org doesn't ask (show nothing). */
export async function neededForJob(job: string, slug: string, viewer: SignViewer): Promise<NeededResult | null> {
  const org = signOrgFor(slug)
  if (!signingEnabled() || !job || !org) return null
  try {
    const res = await call(`/sign/api/v2/needed/${encodeURIComponent(job)}`, org, viewer)
    if (!res.ok) {
      if (res.status !== 503) console.error("client-site sign: needed refused", job, res.status)
      return { ok: false }
    }
    const body = (await res.json()) as Summary
    if (!(body.contract >= 2) || !Array.isArray(body.items)) return { ok: false }
    return { ok: true, items: body.items }
  } catch (err) {
    console.error("client-site sign: needed failed", job, err)
    return { ok: false }
  }
}

/** A harmless second filter on what the engine already scoped: client-facing kinds; for a client, their own paper
 *  and never a sample (except on staging with SIGN_SHOW_SAMPLES=1, marked); staff viewing see every member's (samples
 *  marked). */
export function forClient(items: NeededSignature[], viewer: SignViewer, samples = showSamples()) {
  const staff = "staff" in viewer
  const me = staff ? "" : viewer.email.toLowerCase()
  return items.filter(
    (i) =>
      CLIENT_KINDS.includes(i.kind) &&
      (staff || (!!i.who.email && i.who.email.toLowerCase() === me && (samples || !i.sample))),
  )
}

/** Signed for good: the engine's `satisfied` (a blessed template, countersigned if required, every day covered). */
export const isDone = (s: NeededSignature) => (s.satisfied ?? s.status === "signed") === true

/** Signed by them but not cleared yet (OSC's countersignature, days not covered): the engine shows clients and staff
 *  `state: "signed"` with `satisfied: false`, and refuses a second start. A signed SAMPLE has its own state. */
export const signedNotCleared = (s: NeededSignature) => !isDone(s) && (s.state ? s.state === "signed" : s.status === "signed")

/** For "Needs you" (Sign Here's rule for front-ends: `status !== "signed"`): not signed yet and not cleared. For the
 *  client, also startable now: paper OSC still has to set up (`can_start: false`) stays on the project page, off their
 *  to-do list. Staff viewing as the client always get `can_start: false` from the engine (read-only), so for them
 *  it's the engine's rule alone: they see what the client still owes, and Home never tells them "all set" over it. */
export const needsSigning = (s: NeededSignature, staff = false) =>
  s.status !== "signed" && !isDone(s) && (staff || s.can_start)

export type StartResult = { ok: true; sign_url: string } | { ok: false; reason: "office" | "unavailable" }

/** Mint (or reuse) the signing link for ONE of the viewer's own items. The engine picks the template. Nothing is sent. */
export async function startSigning(job: string, slug: string, email: string, itemId: string): Promise<StartResult> {
  const org = signOrgFor(slug)
  if (!signingEnabled() || !org) return { ok: false, reason: "unavailable" }
  try {
    const res = await call(`/sign/api/v2/start/${encodeURIComponent(job)}`, org, { email }, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    })
    // 409 {needs: "office", why}: Sam sets this one up (or it's still a sample). We show our own fixed words, never
    // the engine's text, so nothing outside our copy reaches a client page.
    if (res.status === 409) return { ok: false, reason: "office" }
    if (!res.ok) {
      console.error("client-site sign: start refused", job, itemId, res.status)
      return { ok: false, reason: "unavailable" }
    }
    const body = (await res.json()) as { agreement_id?: string; sign_url?: string }
    return body.sign_url ? { ok: true, sign_url: body.sign_url } : { ok: false, reason: "unavailable" }
  } catch (err) {
    console.error("client-site sign: start failed", job, itemId, err)
    return { ok: false, reason: "unavailable" }
  }
}

/** The executed PDF, only for the person who signed it (the engine checks the viewer header). */
export async function receipt(agreementId: string, slug: string, email: string): Promise<Response | null> {
  const org = signOrgFor(slug)
  if (!signingEnabled() || !org) return null
  try {
    const res = await call(`/sign/api/v2/receipt/${encodeURIComponent(agreementId)}`, org, { email })
    return res.ok ? res : null
  } catch {
    return null
  }
}

export const signBase = base
