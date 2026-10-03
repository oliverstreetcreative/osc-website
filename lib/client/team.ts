// Team cards (SPEC §21 v2): who's on a project and how to reach them. The facts come from the published book
// (the gate already passed only OSC's details or ones Sam cleared); this file turns them into links and a vCard.

export type TeamMember = {
  id?: string
  name: string
  role: string
  phone?: string
  mobile?: boolean
  email?: string
}

export const OSC_E164 = "+18595121419"
const OSC_DOMAIN = "@oliverstreetcreative.com"

/** Stable id for a member's links: the book's id, else the name as a slug. */
export function memberId(m: TeamMember): string {
  if (m.id) return m.id
  return m.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member"
}

/** The members of a project's `team` JSON, defensively (it's a JSON column), each with an id that's unique on the
 *  card (two "Sam"s, or names with no Latin letters, would otherwise share one). */
export function teamOf(json: unknown): (TeamMember & { uid: string })[] {
  if (!Array.isArray(json)) return []
  const seen = new Map<string, number>()
  return json
    .filter((m): m is TeamMember => !!m && typeof m === "object" && typeof (m as TeamMember).name === "string")
    .map((m) => {
      const base = memberId(m)
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      return { ...m, uid: n === 1 ? base : `${base}-${n}` }
    })
}

/** +1XXXXXXXXXX for a real North American number (area code and exchange start 2–9), else null. */
export function e164(phone: string | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  if (digits.length !== 10 || !/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null
  return `+1${digits}`
}

/** (859) 512-1419 */
export function prettyPhone(phone: string | undefined): string | null {
  const n = e164(phone)
  return n ? `(${n.slice(2, 5)}) ${n.slice(5, 8)}-${n.slice(8)}` : null
}

/** OSC's own people (an OSC address or OSC's line): only they get a saved contact. A freelancer's card shows its
 *  cleared icons but no vCard, which would outlive their alias when they leave (SPEC §21 v2 #3). */
export function isOscMember(m: TeamMember): boolean {
  return (m.email ?? "").toLowerCase().endsWith(OSC_DOMAIN) || e164(m.phone) === OSC_E164
}

// vCard 3.0 text values escape backslash, comma, semicolon and newlines.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n")

/** A vCard 3.0 for one member: name, role, OSC, phone, email. CRLF line endings, as the format requires. */
export function vcard(m: TeamMember): string {
  const parts = m.name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts[parts.length - 1] : ""
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? ""
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(m.name)}`,
    "ORG:Oliver Street Creative",
    `TITLE:${esc(m.role)}`,
  ]
  const tel = e164(m.phone)
  if (tel) lines.push(`TEL;TYPE=${m.mobile ? "CELL" : "WORK"},VOICE:${tel}`)
  if (m.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(m.email)}`)
  lines.push("END:VCARD")
  return lines.join("\r\n") + "\r\n"
}
