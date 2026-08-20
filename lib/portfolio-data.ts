/**
 * Request-time portfolio-pull data.
 *
 * /for/<slug> pages read their definitions from Dropbox at request time so a
 * new prospect pull (or an edit to one) is a data change, not a deploy:
 *
 *   {DROPBOX_ROOT_PREFIX}/_admin/portfolio/for-pages.json
 *   {DROPBOX_ROOT_PREFIX}/_admin/portfolio/logos/<file>   (prospect logos)
 *
 * for-pages.json shape:
 *   {
 *     "videos": [ WorkVideo... ],   // optional extra/override library entries
 *     "pages":  [ ForPage... ]
 *   }
 *
 * Videos in the JSON are merged over the compiled library by slug, so a brand
 * new Mux upload can appear in a pull without shipping code. A ForPage's
 * `prospectLogo` may be either a bundled public path ("/prospect-logos/x.png")
 * or a bare filename in the Dropbox logos folder (served via
 * /api/prospect-logo/<file>).
 *
 * If Dropbox is unreachable the compiled FOR_PAGES/LIBRARY_VIDEOS still serve,
 * so the pages degrade to "last deployed" rather than 500.
 */

import { getDropboxAccessToken } from "./dropbox-auth"
import { FOR_PAGES, type ForPage } from "./for-pages"
import { LIBRARY_VIDEOS, type WorkVideo } from "./work-videos"

const BASE_PATH = "/_admin/portfolio"
const CACHE_MS = 30_000

interface PortfolioData {
  videos: WorkVideo[]
  pages: ForPage[]
}

let cached: { data: PortfolioData; at: number } | null = null

async function dropboxDownload(path: string): Promise<Response | null> {
  const token = await getDropboxAccessToken()
  if (!token) return null
  const rootPrefix = process.env.DROPBOX_ROOT_PREFIX?.trim() ?? ""
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: `${rootPrefix}${path}` }),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    console.error("portfolio-data: download failed", path, res.status)
    return null
  }
  return res
}

/** The merged pull data: Dropbox JSON over the compiled fallback. */
export async function getPortfolioData(): Promise<PortfolioData> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_MS) return cached.data

  let remote: Partial<PortfolioData> = {}
  try {
    const res = await dropboxDownload(`${BASE_PATH}/for-pages.json`)
    if (res) remote = await res.json()
  } catch (err) {
    console.error("portfolio-data: parse failed", err)
  }

  const bySlug = new Map(LIBRARY_VIDEOS.map((v) => [v.slug, v]))
  for (const v of remote.videos ?? []) bySlug.set(v.slug, v)

  const data: PortfolioData = {
    videos: [...bySlug.values()],
    pages: remote.pages ?? FOR_PAGES,
  }
  cached = { data, at: now }
  return data
}

/** A prospect logo from the Dropbox logos folder, or null. */
export async function getProspectLogo(
  filename: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  // Filenames only — no traversal into the rest of Dropbox.
  if (!/^[\w.-]+$/.test(filename)) return null
  const res = await dropboxDownload(`${BASE_PATH}/logos/${filename}`)
  if (!res) return null
  const ext = filename.split(".").pop()?.toLowerCase()
  const contentType =
    ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png"
  return { body: await res.arrayBuffer(), contentType }
}

/** Resolve a ForPage.prospectLogo value to an <img> src. */
export function logoSrc(prospectLogo: string): string {
  return prospectLogo.startsWith("/")
    ? prospectLogo
    : `/api/prospect-logo/${prospectLogo}`
}
