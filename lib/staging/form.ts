// Native gate forms only: stream cap, not an attacker-controlled Content-Length.
export async function gateForm(req: Request): Promise<URLSearchParams | null> {
  if (!(req.headers.get("content-type") ?? "").startsWith("application/x-www-form-urlencoded")) return null
  if (Number(req.headers.get("content-length")) > 4000 || !req.body) return null
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > 4000) { await reader.cancel().catch(() => {}); return null }
    chunks.push(value)
  }
  try { return new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) }
  catch { return null }
}
