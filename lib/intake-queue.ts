import crypto from "node:crypto"
import { getDropboxAccessToken } from "./dropbox-auth"

export type IntakeType = "crew" | "casting" | "locations" | "project"

export interface QueuePayload {
  type: IntakeType
  draft_token?: string
  /**
   * If present, the drain routine will UPDATE the existing form_submissions
   * row referenced by the continuation file (looked up server-side to avoid
   * trusting client-supplied row ids) instead of creating a new row.
   */
  continuation_token?: string
  submitted_at: string
  submitted_from_ip: string
  user_agent?: string
  form_version: number
  data: Record<string, unknown>
}

export type QueueResult =
  | { success: true; filename: string; storage: "dropbox" | "filesystem" }
  | { success: false; error: string }

const QUEUE_PATH = "/_admin/intake-queue/_new"

function buildFilename(type: IntakeType, token: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${date}_${type}_${token}.json`
}

async function writeViaDropbox(
  token: string,
  dropboxPath: string,
  body: string
): Promise<QueueResult> {
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "add",
          autorename: true,
          mute: true,
          strict_conflict: false,
        }),
        "Content-Type": "application/octet-stream",
      },
      body,
    })
    if (!res.ok) {
      const err = await res.text()
      return {
        success: false,
        error: `Dropbox upload ${res.status}: ${err.slice(0, 200)}`,
      }
    }
    const parsed = (await res.json()) as { name?: string }
    return {
      success: true,
      filename: parsed.name || dropboxPath.split("/").pop() || "unknown",
      storage: "dropbox",
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

async function writeViaFilesystem(
  localRoot: string,
  dropboxPath: string,
  body: string
): Promise<QueueResult> {
  try {
    const { writeFile, mkdir } = await import("node:fs/promises")
    const { join, dirname } = await import("node:path")
    const fullPath = join(localRoot, dropboxPath.replace(/^\//, ""))
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, body)
    return {
      success: true,
      filename: fullPath.split("/").pop() || "unknown",
      storage: "filesystem",
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function enqueueIntakeSubmission(
  payload: QueuePayload
): Promise<QueueResult> {
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  const token = payload.draft_token || crypto.randomBytes(16).toString("hex")
  const filename = buildFilename(payload.type, token)
  const dropboxPath = `${QUEUE_PATH}/${filename}`
  // The full payload — type, draft_token, continuation_token, metadata, and
  // data — is serialized as-is so the drain routine sees everything.
  const body = JSON.stringify(payload, null, 2)

  // Local dev: write directly to the filesystem where Dropbox syncs from.
  if (localRoot) {
    return writeViaFilesystem(localRoot, dropboxPath, body)
  }

  // Production: fetch (or refresh) a Dropbox access token, write via API.
  const accessToken = await getDropboxAccessToken()
  if (!accessToken) {
    return {
      success: false,
      error:
        "Queue not configured: set DROPBOX_APP_KEY / DROPBOX_APP_SECRET / " +
        "DROPBOX_REFRESH_TOKEN (production) or DROPBOX_LOCAL_ROOT (local dev)",
    }
  }
  return writeViaDropbox(accessToken, dropboxPath, body)
}

export function generateDraftToken(): string {
  return crypto.randomBytes(16).toString("hex")
}
