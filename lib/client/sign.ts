// Signatures in the client portal: a FRONT-END on Sign Here, the one signature
// engine (Sam 10/3 01:05). Contract: Matters/sign-here/HANDOFF.md, "THE
// CONTRACT — signatures needed (v1)". This module never keeps its own status:
// every read asks the engine (the registry is the truth).
//
// Server-to-server only, with a service token the engine scopes to:
//   GET  {SIGN_HERE_URL}/sign/api/needed/{job}                     -> Summary
//   POST {SIGN_HERE_URL}/sign/api/needed/{job}/start  {item_id, template, mode:"email", email}
//   GET  {SIGN_HERE_URL}/sign/api/receipt/{agreement_id}?for_email= -> application/pdf
// Until SIGN_HERE_URL + SIGN_HERE_SERVICE_TOKEN are set, signing is dormant:
// nothing shows, nothing breaks.
//
// What a CLIENT sees (spine: audience): only items whose `who.email` is one of
// their organization's members, only the client-facing kinds, never a SAMPLE
// (unblessed template). Crew memos, minors' releases and other people's
// releases stay office/crew. Staff viewing as the client see the same list,
// with samples marked.

export type SignKind = "talent_release" | "minor_release" | "location_release" | "client_agreement" | "crew_deal_memo"

export type NeededSignature = {
  id: string
  job: string
  date: string | null
  kind: SignKind
  who: { name: string; role?: string; email?: string; phone?: string }
  templates: string[]
  can_start: boolean
  why_not: string
  status: "missing" | "sent" | "signed"
  agreement_id: string | null
  signed_at: string | null
  signed_name: string | null
  sent_at: string | null
  link_expired: boolean
  sample: boolean
}

type Summary = { contract: number; job: string; items: NeededSignature[] }

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

async function call(path: string, init: RequestInit = {}) {
  return fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
}

/** Everything the engine says this job needs, or null when signing is off or the engine is unreachable. */
export async function neededForJob(job: string): Promise<NeededSignature[] | null> {
  if (!signingEnabled() || !job) return null
  try {
    const res = await call(`/sign/api/needed/${encodeURIComponent(job)}`)
    if (!res.ok) return null
    const body = (await res.json()) as Summary
    return body.contract >= 1 && Array.isArray(body.items) ? body.items : null
  } catch (err) {
    console.error("client-site sign: needed failed", job, err)
    return null
  }
}

/** The client's own paper: their members' items, client-facing kinds, no samples (staff see samples, marked). */
export function forClient(items: NeededSignature[], memberEmails: string[], isStaff: boolean) {
  const emails = new Set(memberEmails.map((e) => e.toLowerCase()))
  return items.filter(
    (i) =>
      CLIENT_KINDS.includes(i.kind) &&
      !!i.who.email &&
      emails.has(i.who.email.toLowerCase()) &&
      (isStaff || !i.sample),
  )
}

export type Started = { agreement_id: string; sign_url: string }

/** Mint (or reuse) the signing link for ONE item, bound to the signer's own email. Nothing is sent. */
export async function startSigning(job: string, itemId: string, template: string, email: string): Promise<Started | null> {
  if (!signingEnabled()) return null
  const res = await call(`/sign/api/needed/${encodeURIComponent(job)}/start`, {
    method: "POST",
    body: JSON.stringify({ item_id: itemId, template, mode: "email", email }),
  })
  if (!res.ok) {
    console.error("client-site sign: start refused", job, itemId, res.status, (await res.text()).slice(0, 200))
    return null
  }
  return (await res.json()) as Started
}

/** The executed PDF, only for the person who signed it (the engine checks). */
export async function receipt(agreementId: string, email: string): Promise<Response | null> {
  if (!signingEnabled()) return null
  const res = await call(`/sign/api/receipt/${encodeURIComponent(agreementId)}?for_email=${encodeURIComponent(email)}`)
  return res.ok ? res : null
}
