// The two support endpoints' shared request rules (SPEC §29 v2): one same-origin check, and a JSON body read under a
// hard cap WHILE it streams (never trusting Content-Length alone: a proxy hop may send the body chunked, review 10/4).

/** The host this request was made to (Railway's proxy sets x-forwarded-host). */
const requestHost = (req: Request) =>
  (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase()

/** True when the request's Origin (or, failing that, Referer) is this same host. */
export function sameOrigin(req: Request): boolean {
  const host = requestHost(req)
  const from = req.headers.get("origin") ?? req.headers.get("referer")
  if (!from || from === "null" || !host) return false
  try {
    return new URL(from).host.toLowerCase() === host
  } catch {
    return false
  }
}

export type CappedJson = { ok: true; body: Record<string, unknown> } | { ok: false; status: 400 | 413 }

/** Read a JSON object body of at most `max` bytes. Over the cap → 413 (stops reading); not a JSON object → 400. */
export async function readJsonCapped(req: Request, max: number): Promise<CappedJson> {
  const declared = Number(req.headers.get("content-length") ?? "NaN")
  if (Number.isFinite(declared) && declared > max) return { ok: false, status: 413 }
  if (!req.body) return { ok: false, status: 400 }
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return { ok: false, status: 413 }
    }
    chunks.push(value)
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ok: true, body: parsed as Record<string, unknown> }
      : { ok: false, status: 400 }
  } catch {
    return { ok: false, status: 400 }
  }
}
