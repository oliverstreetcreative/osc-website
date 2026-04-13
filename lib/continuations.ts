/**
 * Continuation token loader.
 *
 * When Sam asks a client for more info on a submitted form, the
 * project-intake-admin skill writes a JSON file at
 * /_admin/intake-queue/_continuations/{token}.json containing the current
 * answers, Sam's note, and the fields he's requesting. The form URL
 * /f/{slug}?continuation={token} reads this file and pre-fills the form.
 *
 * On submit, the POST includes the continuation_token; the drain reads
 * the same file to get the Bible row id and UPDATEs the existing row
 * instead of creating a new one.
 *
 * No in-memory cache — continuations are one-shot and consumed on submit.
 */

import { getDropboxAccessToken } from "./dropbox-auth"

export interface Continuation {
  continuation_token: string
  form_slug: string
  form_submission_id: number
  round_number: number
  created_at: string
  expires_at?: string
  sam_note?: string
  requested_fields?: string[]
  existing_answers: Record<string, unknown>
}

const CONTINUATIONS_PATH = "/_admin/intake-queue/_continuations"

async function loadFromDropbox(token: string): Promise<Continuation | null> {
  const apiToken = await getDropboxAccessToken()
  if (!apiToken) return null
  const rootPrefix = process.env.DROPBOX_ROOT_PREFIX?.trim() ?? ""
  const dropboxPath = `${rootPrefix}${CONTINUATIONS_PATH}/${token}.json`
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
      },
    })
    if (res.status === 409) return null
    if (!res.ok) {
      console.error(`continuations: dropbox ${res.status} for ${token}`)
      return null
    }
    const text = await res.text()
    return JSON.parse(text) as Continuation
  } catch (err) {
    console.error("continuations: dropbox fetch failed:", err)
    return null
  }
}

async function loadFromFilesystem(
  token: string
): Promise<Continuation | null> {
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  if (!localRoot) return null
  try {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const path = join(
      localRoot,
      CONTINUATIONS_PATH.replace(/^\//, ""),
      `${token}.json`
    )
    const text = await readFile(path, "utf8")
    return JSON.parse(text) as Continuation
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    console.error("continuations: filesystem read failed:", err)
    return null
  }
}

/** Basic token format check to avoid path traversal or garbage lookups. */
export function isValidContinuationToken(token: string): boolean {
  return /^[a-f0-9]{16,64}$/.test(token)
}

export async function getContinuation(
  token: string
): Promise<Continuation | null> {
  if (!isValidContinuationToken(token)) return null
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  return localRoot ? loadFromFilesystem(token) : loadFromDropbox(token)
}
