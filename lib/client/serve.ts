// Serving client files. Every path served here came from a book (the
// allowlist) via the database, and only after the session's membership check.
import { NextResponse } from "next/server"
import { download, temporaryLink, localFileResponse } from "./dropbox"

const TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", srt: "text/plain; charset=utf-8", zip: "application/zip",
}
export const typeOf = (path: string) => TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream"
const fileName = (path: string) => path.split("/").pop() ?? "file"

/**
 * Defence in depth behind the gate's lint: only a plain root-relative path is ever served (no "..", ".", empty
 * segments or backslashes), so "/Clients/Acme/../Other/x.pdf" can't reach another client's folder even if a book
 * carried it.
 */
export const plainPath = (p: string) =>
  p.startsWith("/") && !p.includes("\\") && !p.includes("\0") && p.split("/").slice(1).every((s) => s !== "" && s !== "." && s !== "..")
const refused = () => new NextResponse("File not available.", { status: 404 })

/** Small files (PDFs, stills): stream through us. inline = view in the browser. */
export async function streamFile(path: string, opts: { inline?: boolean; downloadName?: string } = {}) {
  if (!plainPath(path)) return refused()
  const res = await download(path)
  if (!res || !res.body) return new NextResponse("File not available right now.", { status: 404 })
  const name = opts.downloadName ?? fileName(path)
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": typeOf(path),
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

/** Big files (films): hand the browser a short-lived Dropbox link. */
export async function redirectToFile(path: string, req: Request) {
  if (!plainPath(path)) return refused()
  const link = await temporaryLink(path)
  if (link) return NextResponse.redirect(link, 302)
  const local = await localFileResponse(path, req.headers.get("range"), typeOf(path))
  return local ?? new NextResponse("File not available right now.", { status: 404 })
}
