// OSC Review (our FreeFrame) as the portal reads it (SPEC §13 v4). Server only.
//   Versions are read LIVE from Review's public share API, never typed into a book:
//     GET <api>/share/{token}/assets/{asset}/versions   → [{id, version_number, processing_status, created_at}]
//       (ready versions only; no "open" logged; only the newest unless the link shows all versions)
//     GET <api>/share/{token}/stream/{asset}?version_id → {url, version_id, …} (HLS relative to the API; logs a view;
//       serves the LATEST when the link hides older versions or that version isn't ready: check version_id)
//   Errors, from FreeFrame's services/permissions.py (checked 10/3 20:50): 404 "Share link not found", 403 "Share link
//   is disabled", 410 "Share link has expired", 403 "Password required", 403 "Authentication required for this link's
//   visibility setting" (a `secure` link), 403 "Asset … not … share" (an asset id the link doesn't carry), 400
//   "Invalid share link", 404 "Asset not found", 422 a malformed id. Only the password and secure answers mean
//   "locked"; every other refusal means the link (or the book's asset id) no longer works: "gone".
export const REVIEW_API = (process.env.REVIEW_API_URL?.trim() || "https://review.oliverstreetcreative.com/api").replace(/\/$/, "")
const SHARE_URL = /^https:\/\/review\.oliverstreetcreative\.com\/share\/([A-Za-z0-9_-]{8,128})\/?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMEOUT_MS = 5000
const CACHE_MS = 60_000
const UNREACHABLE_CACHE_MS = 15_000 // a hung Review costs one 5 s wait per film per 15 s, not one per page render

/** The share token in a Review share link, or null (Frame.io links, team links, anything else). */
export function shareToken(url: string | null | undefined): string | null {
  const m = url ? SHARE_URL.exec(url.trim()) : null
  return m ? m[1] : null
}

export type ReviewWhy = "unreachable" | "locked" | "gone" | "processing"
export type ReviewVersion = { id: string; n: number; posted_at: string | null }
export type VersionsResult = { ok: true; versions: ReviewVersion[] } | { ok: false; why: ReviewWhy }

const cache = new Map<string, { at: number; ttl: number; result: VersionsResult }>()

async function detail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    return typeof body?.detail === "string" ? body.detail : ""
  } catch {
    return ""
  }
}

/** The link's ready versions, newest first. `fresh` skips the cache (the approve page and the approval itself). */
export async function reviewVersions(token: string, assetId: string, opts: { fresh?: boolean } = {}): Promise<VersionsResult> {
  if (!UUID.test(assetId)) return { ok: false, why: "gone" }
  const key = `${token}/${assetId}`
  const hit = cache.get(key)
  if (!opts.fresh && hit && Date.now() - hit.at < hit.ttl) return hit.result
  let result: VersionsResult
  try {
    const res = await fetch(`${REVIEW_API}/share/${encodeURIComponent(token)}/assets/${assetId}/versions`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) {
      const d = await detail(res)
      result = { ok: false, why: /password required|authentication required/i.test(d) ? "locked" : "gone" }
    } else if (res.status === 400 || res.status === 404 || res.status === 410 || res.status === 422) result = { ok: false, why: "gone" }
    else if (!res.ok) result = { ok: false, why: "unreachable" }
    else {
      const rows = (await res.json()) as { id?: unknown; version_number?: unknown; processing_status?: unknown; created_at?: unknown }[]
      const versions = (Array.isArray(rows) ? rows : [])
        .filter((r) => typeof r.id === "string" && UUID.test(r.id) && typeof r.version_number === "number" && (r.processing_status ?? "ready") === "ready")
        .map((r) => ({ id: r.id as string, n: r.version_number as number, posted_at: typeof r.created_at === "string" ? r.created_at : null }))
        .sort((a, b) => b.n - a.n)
      // Review lists READY versions only: an empty list is a first cut still transcoding, not an ended link.
      result = versions.length ? { ok: true, versions } : { ok: false, why: "processing" }
    }
  } catch {
    result = { ok: false, why: "unreachable" }
  }
  cache.set(key, { at: Date.now(), ttl: !result.ok && result.why === "unreachable" ? UNREACHABLE_CACHE_MS : CACHE_MS, result })
  return result
}

/**
 * A playable URL for EXACTLY this version (HLS for video), or null. Review falls back to its latest version when the
 * link hides older ones or the asked-for one isn't ready, so the answer counts only if it names the same version.
 * Each call logs a view on the link in Review.
 */
export async function versionStream(token: string, assetId: string, versionId: string): Promise<string | null> {
  if (!UUID.test(assetId) || !UUID.test(versionId)) return null
  try {
    const res = await fetch(`${REVIEW_API}/share/${encodeURIComponent(token)}/stream/${assetId}?version_id=${versionId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { url?: unknown; version_id?: unknown }
    if (typeof body.version_id !== "string" || body.version_id.toLowerCase() !== versionId.toLowerCase()) return null
    if (typeof body.url !== "string" || !body.url) return null
    if (body.url.startsWith("https://")) return body.url
    return body.url.startsWith("/") ? `${REVIEW_API}${body.url}` : null
  } catch {
    return null
  }
}

/** Words for a failed read, said plainly to the client (§13 v3). None of them promise that anyone was told. */
export const REVIEW_WHY: Record<ReviewWhy, string> = {
  unreachable: "Couldn't confirm the video. Try again in a minute.",
  locked: "This cut has a password, so it plays only in Review.",
  gone: "This review link has ended. Text Sam and he'll send a fresh one.",
  processing: "This cut is still processing. Try again in a few minutes.",
}
