/**
 * Form definitions loader.
 *
 * Form definitions are JSON files stored in Dropbox at
 * /_admin/form-definitions/{slug}.json. Authoritative. Edit via the
 * `new-intake-form` skill (or by hand for now) and they take effect
 * within a 60-second cache window — no redeploy needed.
 *
 * On Railway (production): fetched via the Dropbox API using
 * DROPBOX_ACCESS_TOKEN.
 *
 * On local dev: read from the filesystem when DROPBOX_LOCAL_ROOT is set,
 * pointing at the Dropbox folder root on the developer's laptop.
 */

export interface SurveyJsPage {
  name: string
  title?: string
  description?: string
  elements: SurveyJsElement[]
}

export interface SurveyJsElement {
  type: string
  name: string
  title?: string
  description?: string
  isRequired?: boolean
  [key: string]: unknown
}

export interface SurveyJsSchema {
  title?: string
  description?: string
  showProgressBar?: string
  progressBarType?: string
  showQuestionNumbers?: string
  completeText?: string
  pageNextText?: string
  pagePrevText?: string
  pages: SurveyJsPage[]
  [key: string]: unknown
}

import { getDropboxAccessToken } from "./dropbox-auth"

export interface FormDefinition {
  slug: string
  title: string
  subtitle?: string
  version: number
  surveyJson: SurveyJsSchema
}

const CACHE_TTL_MS = 60 * 1000
type CacheEntry = { value: FormDefinition | null; expires: number }
const cache = new Map<string, CacheEntry>()

const DEFINITIONS_PATH = "/_admin/form-definitions"

async function fetchFromDropbox(slug: string): Promise<FormDefinition | null> {
  const token = await getDropboxAccessToken()
  if (!token) return null
  const dropboxPath = `${DEFINITIONS_PATH}/${slug}.json`
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
      },
    })
    if (res.status === 409) {
      // Dropbox returns 409 for "file not found"
      return null
    }
    if (!res.ok) {
      console.error(`form-definitions: dropbox ${res.status} for ${slug}`)
      return null
    }
    const text = await res.text()
    return JSON.parse(text) as FormDefinition
  } catch (err) {
    console.error("form-definitions: dropbox fetch failed:", err)
    return null
  }
}

async function fetchFromFilesystem(
  slug: string
): Promise<FormDefinition | null> {
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  if (!localRoot) return null
  try {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const path = join(
      localRoot,
      DEFINITIONS_PATH.replace(/^\//, ""),
      `${slug}.json`
    )
    const text = await readFile(path, "utf8")
    return JSON.parse(text) as FormDefinition
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    console.error("form-definitions: filesystem read failed:", err)
    return null
  }
}

export async function getFormDefinition(
  slug: string
): Promise<FormDefinition | null> {
  const now = Date.now()
  const cached = cache.get(slug)
  if (cached && cached.expires > now) {
    return cached.value
  }

  // Prefer filesystem in local dev; production has no local root and uses Dropbox.
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  const definition = localRoot
    ? await fetchFromFilesystem(slug)
    : await fetchFromDropbox(slug)

  cache.set(slug, { value: definition, expires: now + CACHE_TTL_MS })
  return definition
}

export function clearFormDefinitionCache(slug?: string): void {
  if (slug) cache.delete(slug)
  else cache.clear()
}
