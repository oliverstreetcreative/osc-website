// Read-only Dropbox access for the client site. Paths are root-relative
// ("/_admin/client-site/books/x.json", "/Clients/Beech Acres/...") and get
// DROPBOX_ROOT_PREFIX prepended, exactly like lib/portfolio-data.ts.
// Local dev: set DROPBOX_LOCAL_ROOT to the synced "OLIVER STREET CREATIVE"
// folder and everything reads from disk instead.
import { promises as fs } from "fs"
import { join } from "path"
import { getDropboxAccessToken } from "@/lib/dropbox-auth"

const prefix = () => process.env.DROPBOX_ROOT_PREFIX?.trim() ?? ""
const localRoot = () => process.env.DROPBOX_LOCAL_ROOT?.trim() || ""

export async function listJson(folder: string): Promise<string[]> {
  if (localRoot()) {
    const dir = join(localRoot(), folder.replace(/^\//, ""))
    const names = await fs.readdir(dir).catch(() => [] as string[])
    return names.filter((n) => n.endsWith(".json") && !n.startsWith(".") && !n.startsWith("_")).map((n) => `${folder}/${n}`)
  }
  const token = await getDropboxAccessToken()
  if (!token) throw new Error("Dropbox not configured")
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: `${prefix()}${folder}` }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Dropbox list ${folder}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { entries: { ".tag": string; name: string }[] }
  return body.entries
    .filter((e) => e[".tag"] === "file" && e.name.endsWith(".json") && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => `${folder}/${e.name}`)
}

/**
 * JSON files in `folder` with a revision marker (Dropbox's rev, or mtime+size locally), so an unchanged file needn't
 * be read again. [] when the folder doesn't exist; null when the listing itself failed (then hide nothing).
 */
export async function listJsonEntries(folder: string): Promise<{ path: string; rev: string }[] | null> {
  const wanted = (n: string) => n.endsWith(".json") && !n.startsWith(".") && !n.startsWith("_")
  if (localRoot()) {
    const dir = join(localRoot(), folder.replace(/^\//, ""))
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch (e) {
      return (e as NodeJS.ErrnoException)?.code === "ENOENT" ? [] : null
    }
    const out: { path: string; rev: string }[] = []
    for (const n of names.filter(wanted)) {
      const st = await fs.stat(join(dir, n)).catch(() => null)
      if (st?.isFile()) out.push({ path: `${folder}/${n}`, rev: `${st.mtimeMs}-${st.size}` })
    }
    return out
  }
  const token = await getDropboxAccessToken()
  if (!token) return null
  try {
    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${prefix()}${folder}` }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 409 && /not_found/.test(await res.clone().text())) return []
    if (!res.ok) return null
    const body = (await res.json()) as { entries: { ".tag": string; name: string; rev?: string }[]; has_more?: boolean }
    if (body.has_more) return null // more files than one page: never treat a partial listing as the whole
    return body.entries.filter((e) => e[".tag"] === "file" && wanted(e.name)).map((e) => ({ path: `${folder}/${e.name}`, rev: e.rev ?? "" }))
  } catch {
    return null
  }
}

export async function readText(path: string): Promise<string> {
  if (localRoot()) return fs.readFile(join(localRoot(), path.replace(/^\//, "")), "utf8")
  const res = await download(path)
  if (!res) throw new Error(`Dropbox download failed: ${path}`)
  return res.text()
}

/** Streamable download. Returns null when the file is missing or Dropbox is down. */
export async function download(path: string): Promise<Response | null> {
  if (localRoot()) {
    try {
      const buf = await fs.readFile(join(localRoot(), path.replace(/^\//, "")))
      return new Response(buf)
    } catch {
      return null
    }
  }
  const token = await getDropboxAccessToken()
  if (!token) return null
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Dropbox-API-Arg must be ASCII: escape non-ASCII as \uXXXX.
      "Dropbox-API-Arg": JSON.stringify({ path: `${prefix()}${path}` }).replace(
        /[\u007f-￿]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
      ),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    console.error("client-site dropbox: download failed", path, res.status)
    return null
  }
  return res
}

/**
 * A short-lived (4h) direct link for big files (films). Local dev returns null
 * and callers stream from disk instead.
 */
export async function temporaryLink(path: string): Promise<string | null> {
  if (localRoot()) return null
  const token = await getDropboxAccessToken()
  if (!token) return null
  const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: `${prefix()}${path}` }),
    cache: "no-store",
  })
  if (!res.ok) {
    console.error("client-site dropbox: temp link failed", path, res.status)
    return null
  }
  return ((await res.json()) as { link: string }).link
}

/** Local-dev streaming with Range support (so <video> can seek). */
export async function localFileResponse(path: string, range: string | null, type: string): Promise<Response | null> {
  if (!localRoot()) return null
  const full = join(localRoot(), path.replace(/^\//, ""))
  const stat = await fs.stat(full).catch(() => null)
  if (!stat) return null
  const { createReadStream } = await import("fs")
  const { Readable } = await import("stream")
  const m = range?.match(/bytes=(\d*)-(\d*)/)
  if (m) {
    const start = m[1] ? Number(m[1]) : 0
    const end = m[2] ? Number(m[2]) : stat.size - 1
    const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    })
  }
  const body = Readable.toWeb(createReadStream(full)) as ReadableStream
  return new Response(body, { headers: { "Content-Type": type, "Content-Length": String(stat.size), "Accept-Ranges": "bytes" } })
}
