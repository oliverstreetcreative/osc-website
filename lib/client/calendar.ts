// Canonical calendar events (Sam, 10/2): every dated thing in a project is ONE
// event owned by the website. Clients can add one event (.ics / Google) or
// subscribe to a private per-person feed that updates itself when dates move.
// Every event links back to the page where they act.
//
// Event ids are stable: shoot-<shootId>, due-<invoiceId>, date-<projectId>-<n>.
import { db } from "@/lib/db"
import { day } from "./format"
import { seesMoney } from "./money"

export type CalEvent = {
  uid: string
  id: string
  title: string
  date: Date // all-day, calendar date at noon UTC
  end?: Date // last day (inclusive) for multi-day events
  description: string
  location?: string
  path: string // site path to act on it
}

type ProjectLite = { id: string; name: string; slug: string | null; dates: unknown; organization: { name: string; short_name: string | null } | null }

function projectEvents(p: ProjectLite & {
  shoot_periods: { id: string; description: string | null; start_date: Date; end_date: Date; call_time: string | null; location: string | null; address: string | null; bring: string | null }[]
}): CalEvent[] {
  const org = p.organization?.short_name ?? p.organization?.name ?? ""
  const path = `/client/projects/${p.slug}`
  const out: CalEvent[] = []
  for (const s of p.shoot_periods) {
    const label = s.description ?? "Filming day"
    out.push({
      id: `shoot-${s.id}`,
      uid: `shoot-${s.id}@oliverstreetcreative.com`,
      title: `${label}: ${p.name}${s.call_time ? ` (call ${s.call_time})` : ""}`,
      date: s.start_date,
      end: s.end_date > s.start_date ? s.end_date : undefined,
      location: [s.location, s.address].filter(Boolean).join(", ") || undefined,
      description: [
        `${org} · ${p.name}`,
        s.call_time ? `Call time: ${s.call_time}` : null,
        s.location ? `Where: ${[s.location, s.address].filter(Boolean).join(", ")}` : null,
        s.bring ? `Bring: ${s.bring}` : null,
      ].filter(Boolean).join("\n"),
      path,
    })
  }
  const dates = Array.isArray(p.dates) ? (p.dates as { label: string; date: string; note?: string }[]) : []
  const cutoff = Date.now() - 14 * 86_400_000 // history stays out of their calendar
  dates.forEach((d, i) => {
    if (new Date(`${d.date}T12:00:00Z`).getTime() < cutoff) return
    out.push({
      id: `date-${p.id}-${i}`,
      uid: `date-${p.id}-${i}@oliverstreetcreative.com`,
      title: `${d.label}: ${p.name}`,
      date: new Date(`${d.date}T12:00:00Z`),
      description: [`${org} · ${p.name}`, d.note].filter(Boolean).join("\n"),
      path,
    })
  })
  return out
}

function invoiceEvent(inv: { id: string; number: string; title: string; amount: unknown; due_on: Date | null }): CalEvent | null {
  if (!inv.due_on) return null
  const amount = Number(String(inv.amount)).toLocaleString("en-US", { style: "currency", currency: "USD" })
  return {
    id: `due-${inv.id}`,
    uid: `due-${inv.id}@oliverstreetcreative.com`,
    title: `Invoice ${inv.number} due (${amount})`,
    date: inv.due_on,
    description: `${inv.title}\n${amount}, due ${day(inv.due_on)}`,
    path: "/client/billing",
  }
}

const projectInclude = {
  organization: { select: { name: true, short_name: true } },
  shoot_periods: { where: { hidden: false } },
} as const

/** Every event visible to this person, across all their organizations. */
export async function eventsForPerson(personId: string, isStaff = false): Promise<CalEvent[]> {
  const orgIds = isStaff
    ? (await db.organization.findMany({ where: { hidden: false }, select: { id: true } })).map((o) => o.id)
    : (
        await db.membership.findMany({
          // A revoked client (hidden org) drops out of every feed on the next refresh.
          where: { person_id: personId, hidden: false, organization: { hidden: false } },
          select: { organization_id: true },
        })
      ).map((m) => m.organization_id)
  if (!orgIds.length) return []
  const projects = await db.project.findMany({ where: { organization_id: { in: orgIds }, hidden: false }, include: projectInclude })
  // Invoice due dates carry amounts: only for orgs where this person sees money (a VIEWER doesn't: SPEC §10.5b,
  // §28 v2). Staff feeds see every org's.
  const moneyOrgIds = isStaff
    ? orgIds
    : (
        await db.membership.findMany({
          where: { person_id: personId, hidden: false, organization_id: { in: orgIds } },
          select: { organization_id: true, role: true },
        })
      )
        .filter((m) => seesMoney(m.role))
        .map((m) => m.organization_id)
  const invoices = moneyOrgIds.length
    ? await db.invoice.findMany({ where: { organization_id: { in: moneyOrgIds }, hidden: false, status: "open" } })
    : []
  return [
    ...projects.flatMap((p) => projectEvents(p as any)),
    ...invoices.map(invoiceEvent).filter((e): e is CalEvent => !!e),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** One event, only if it belongs to one of these organizations. An invoice's due date is money: only from
 *  `moneyOrgIds`, the orgs where this person sees money (SPEC §28 v2 review: a VIEWER with the id got "$X due"). */
export async function eventForOrgs(id: string, orgIds: string[], moneyOrgIds: string[]): Promise<CalEvent | null> {
  if (id.startsWith("due-")) {
    const allowed = orgIds.filter((o) => moneyOrgIds.includes(o))
    if (!allowed.length) return null
    const inv = await db.invoice.findFirst({ where: { id: id.slice(4), organization_id: { in: allowed }, hidden: false } })
    return inv ? invoiceEvent(inv) : null
  }
  let projectId: string | null = null
  if (id.startsWith("shoot-")) {
    const s = await db.shootPeriod.findFirst({ where: { id: id.slice(6), hidden: false } })
    projectId = s?.project_id ?? null
  } else if (id.startsWith("date-")) {
    projectId = id.slice(5, 41)
  }
  if (!projectId) return null
  const p = await db.project.findFirst({ where: { id: projectId, organization_id: { in: orgIds }, hidden: false }, include: projectInclude })
  if (!p) return null
  return projectEvents(p as any).find((e) => e.id === id) ?? null
}

// ---------- ICS ----------
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "")
const nextDay = (d: Date) => new Date(d.getTime() + 86_400_000)
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

function fold(line: string) {
  // RFC 5545: lines longer than 75 octets are folded.
  const out: string[] = []
  let s = line
  while (Buffer.byteLength(s) > 75) {
    let n = 75
    while (Buffer.byteLength(s.slice(0, n)) > 75) n--
    out.push(s.slice(0, n))
    s = " " + s.slice(n)
  }
  out.push(s)
  return out.join("\r\n")
}

export function toICS(events: CalEvent[], origin: string, name = "Oliver Street Creative") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oliver Street Creative//Client site//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ]
  for (const e of events) {
    const url = `${origin}${e.path}`
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.end ?? e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.description}\n\nOpen in your Oliver Street Creative account: ${url}`)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      `URL:${url}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}

export function googleLink(e: CalEvent, origin: string) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${ymd(e.date)}/${ymd(nextDay(e.end ?? e.date))}`,
    details: `${e.description}\n\n${origin}${e.path}`,
  })
  if (e.location) p.set("location", e.location)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
