// OSC Review (our FreeFrame) as the portal reads it (SPEC §13 v4). Server only.
//   Versions are read LIVE from Review's public share API, never typed into a book:
//     GET <api>/share/{token}/assets/{asset}/versions   → [{id, version_number, processing_status, created_at}]
//       (no "open" logged; only the newest unless the link shows all versions)
//     GET <api>/share/{token}/stream/{asset}?version_id → {url} (HLS for video, relative to the API; logs a view)
//   Password and secure links can't be read without the viewer's own session: no Approve button for them.
// Facts checked 10/3 in FreeFrame's share router and against review.oliverstreetcreative.com/api.
export const REVIEW_API = (process.env.REVIEW_API_URL?.trim() || "https://review.oliverstreetcreative.com/api").replace(/\/$/, "")
const SHARE_URL = /^https:\/\/review\.oliverstreetcreative\.com\/share\/([A-Za-z0-9_-]{8,128})\/?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMEOUT_MS = 5000
const CACHE_MS = 60_000

/** The share token in a Review share link, or null (Frame.io links, team links, anything else). */
export function shareToken(url: string | null | undefined): string | null {
  const m = url ? SHARE_URL.exec(url.trim()) : null
  return m ? m[1] : null
}

export type ReviewVersion = { id: string; n: number; posted_at: string | null }
export type VersionsResult =
  | { ok: true; versions: ReviewVersion[] }
  | { ok: false; why: "unreachable" | "locked" | "gone" }

const cache = new Map<string, { at: number; result: VersionsResult }>()

/** The link's ready versions, newest first. `fresh` skips the 60 s cache (an approval re-reads at the moment it lands). */
export async function reviewVersions(token: string, assetId: string, opts: { fresh?: boolean } = {}): Promise<VersionsResult> {
  if (!UUID.test(assetId)) return { ok: false, why: "gone" }
  const key = `${token}/${assetId}`
  const hit = cache.get(key)
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.result
  let result: VersionsResult
  try {
    const res = await fetch(`${REVIEW_API}/share/${encodeURIComponent(token)}/assets/${assetId}/versions`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) result = { ok: false, why: "locked" }
    else if (res.status === 404 || res.status === 410) result = { ok: false, why: "gone" }
    else if (!res.ok) result = { ok: false, why: "unreachable" }
    else {
      const rows = (await res.json()) as { id?: unknown; version_number?: unknown; processing_status?: unknown; created_at?: unknown }[]
      const versions = (Array.isArray(rows) ? rows : [])
        .filter((r) => typeof r.id === "string" && UUID.test(r.id) && typeof r.version_number === "number" && (r.processing_status ?? "ready") === "ready")
        .map((r) => ({ id: r.id as string, n: r.version_number as number, posted_at: typeof r.created_at === "string" ? r.created_at : null }))
        .sort((a, b) => b.n - a.n)
      result = versions.length ? { ok: true, versions } : { ok: false, why: "gone" }
    }
  } catch {
    result = { ok: false, why: "unreachable" }
  }
  if (result.ok || result.why !== "unreachable") cache.set(key, { at: Date.now(), result })
  return result
}

/** A playable URL for EXACTLY this version (HLS for video), or null. Each call logs a view on the link in Review. */
export async function versionStream(token: string, assetId: string, versionId: string): Promise<string | null> {
  if (!UUID.test(assetId) || !UUID.test(versionId)) return null
  try {
    const res = await fetch(`${REVIEW_API}/share/${encodeURIComponent(token)}/stream/${assetId}?version_id=${versionId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { url?: unknown }
    if (typeof body.url !== "string" || !body.url) return null
    if (body.url.startsWith("https://")) return body.url
    return body.url.startsWith("/") ? `${REVIEW_API}${body.url}` : null
  } catch {
    return null
  }
}

/** Words for a failed read, said plainly to the client (§13 v3). */
export const REVIEW_WHY: Record<"unreachable" | "locked" | "gone", string> = {
  unreachable: "Couldn't confirm the video. Try again in a minute.",
  locked: "This cut is behind a password: approve it in a reply to Sam.",
  gone: "This review link has ended. Text Sam and he'll send a fresh one.",
}
