// The client's address for an audit record (SPEC §22 v2.1; Sign Here's rule too). Railway's edge APPENDS the address
// it saw to X-Forwarded-For, so the LAST hop is the client's; earlier hops are whatever the browser claimed. Checked
// 10/4: a staging acceptance recorded this Mac's own VPN exit (Datacamp, Chicago), not a Railway-internal address.
// Pure (tested in ip.test.ts).
export function clientIp(h: Headers): string | null {
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return hops.length ? hops[hops.length - 1] : h.get("x-real-ip")?.trim() || null
}
