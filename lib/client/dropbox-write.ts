// Add-only writes into the shared Dropbox (server only): the intake queue (SPEC §17), the approvals ledger (§13), the
// scripts' exports (§14). A fixed name and no autorename, so a retry after a timeout that actually landed can't
// duplicate a file; an existing file is reported, never overwritten. DROPBOX_LOCAL_ROOT (local dev) writes to disk.
import { promises as fs } from "fs"
import { dirname, join } from "path"
import { getDropboxAccessToken } from "@/lib/dropbox-auth"

const DROPBOX_TIMEOUT_MS = 8000

/** JSON that's pure ASCII (Dropbox-API-Arg is an HTTP header). */
export const asciiJson = (o: unknown) =>
  JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))

/**
 * Write a NEW binary file (a client's upload, SPEC §31 v2): the same add-only rules as `writeNewFile`, and a timeout
 * that grows with the file (8 s, plus a second per 512 KB: a 25 MB file gets about a minute). An "exists" answer is
 * reported as such; the caller treats it as a failed upload (stored names never repeat).
 */
export async function writeNewBinary(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<"written" | "exists" | string> {
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  if (localRoot) {
    const full = join(localRoot, path.replace(/^\//, ""))
    try {
      await fs.mkdir(dirname(full), { recursive: true })
      await fs.writeFile(full, bytes, { flag: "wx" })
      return "written"
    } catch (e) {
      return (e as NodeJS.ErrnoException)?.code === "EEXIST" ? "exists" : String((e as Error)?.message ?? e)
    }
  }
  const token = await getDropboxAccessToken()
  if (!token) return "Dropbox is not configured"
  const prefix = process.env.DROPBOX_ROOT_PREFIX?.trim() ?? ""
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": asciiJson({ path: `${prefix}${path}`, mode: "add", autorename: false, mute: true, strict_conflict: false }),
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(DROPBOX_TIMEOUT_MS + Math.ceil(bytes.byteLength / (512 * 1024)) * 1000),
    })
    if (res.ok) return "written"
    const text = await res.text()
    if (res.status === 409 && /path\/conflict\/file/.test(text)) return "exists"
    return `Dropbox ${res.status}: ${text.slice(0, 200)}`
  } catch (e) {
    return String((e as Error)?.message ?? e)
  }
}

/** Write a NEW file at `path` (root-relative, "/_admin/..."). "written", "exists", or an error message. */
export async function writeNewFile(path: string, body: string): Promise<"written" | "exists" | string> {
  const localRoot = process.env.DROPBOX_LOCAL_ROOT?.trim()
  if (localRoot) {
    const full = join(localRoot, path.replace(/^\//, ""))
    try {
      await fs.mkdir(dirname(full), { recursive: true })
      await fs.writeFile(full, body, { flag: "wx" })
      return "written"
    } catch (e) {
      return (e as NodeJS.ErrnoException)?.code === "EEXIST" ? "exists" : String((e as Error)?.message ?? e)
    }
  }
  const token = await getDropboxAccessToken()
  if (!token) return "Dropbox is not configured"
  const prefix = process.env.DROPBOX_ROOT_PREFIX?.trim() ?? ""
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": asciiJson({ path: `${prefix}${path}`, mode: "add", autorename: false, mute: true, strict_conflict: false }),
        "Content-Type": "application/octet-stream",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(DROPBOX_TIMEOUT_MS),
    })
    if (res.ok) return "written"
    const text = await res.text()
    // Only "a FILE is already at this path" means it's there; folder conflicts and the rest are real errors.
    if (res.status === 409 && /path\/conflict\/file/.test(text)) return "exists"
    return `Dropbox ${res.status}: ${text.slice(0, 200)}`
  } catch (e) {
    return String((e as Error)?.message ?? e)
  }
}
