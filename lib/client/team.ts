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

/** The members of a project's `team` JSON, defensively (it's a JSON column). */
export function teamOf(json: unknown): TeamMember[] {
  if (!Array.isArray(json)) return []
  return json.filter((m): m is TeamMember => !!m && typeof m === "object" && typeof (m as TeamMember).name === "string")
}

/** Stable id for a member's links: the book's id, else the name as a slug. */
export function memberId(m: TeamMember): string {
  if (m.id) return m.id
  return m.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member"
}

/** +1XXXXXXXXXX, or null when it isn't a North American number. */
export function e164(phone: string | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  return digits.length === 10 ? `+1${digits}` : null
}

/** (859) 512-1419 */
export function prettyPhone(phone: string | undefined): string | null {
  const n = e164(phone)
  return n ? `(${n.slice(2, 5)}) ${n.slice(5, 8)}-${n.slice(8)}` : null
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
