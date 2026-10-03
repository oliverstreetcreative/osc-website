// Read models for the client pages. Every query is scoped to ONE organization
// id that came from getClientContext() — never from the URL alone.
import { db } from "@/lib/db"
import { daysFromToday, todayUTC } from "./format"
import { neededForJob, forClient, signingEnabled, type NeededSignature } from "./sign"

const visible = { hidden: false } as const

export async function orgProjects(orgId: string) {
  return db.project.findMany({
    where: { organization_id: orgId, ...visible },
    include: {
      deliverables: { where: visible, orderBy: { sort: "asc" } },
      shoot_periods: { where: visible, orderBy: { start_date: "asc" } },
      invoices: { where: visible },
    },
    orderBy: [{ sort_date: "desc" }],
  })
}
export type ProjectWithAll = Awaited<ReturnType<typeof orgProjects>>[number]

export async function orgProject(orgId: string, slug: string) {
  return db.project.findFirst({
    where: { organization_id: orgId, slug, ...visible },
    include: {
      deliverables: { where: visible, orderBy: { sort: "asc" } },
      shoot_periods: { where: visible, orderBy: { start_date: "asc" } },
      invoices: { where: visible, orderBy: { issued_on: "desc" } },
      documents: { where: visible, orderBy: [{ dated_on: "desc" }, { title: "asc" }] },
    },
  })
}

export async function orgInvoices(orgId: string) {
  return db.invoice.findMany({
    where: { organization_id: orgId, ...visible, status: { not: "void" } },
    include: { project: { select: { name: true, slug: true } } },
    orderBy: [{ issued_on: "desc" }],
  })
}

export async function orgDocuments(orgId: string) {
  return db.document.findMany({
    where: { organization_id: orgId, ...visible },
    include: { project: { select: { name: true, slug: true, job_number: true } } },
    orderBy: [{ dated_on: "desc" }, { title: "asc" }],
  })
}

export type NeedsItem =
  | { kind: "invoice"; urgency: number; invoice: Awaited<ReturnType<typeof orgInvoices>>[number] }
  | { kind: "shoot"; urgency: number; project: ProjectWithAll; shoot: ProjectWithAll["shoot_periods"][number] }
  | { kind: "review"; urgency: number; project: ProjectWithAll; film: ProjectWithAll["deliverables"][number] }
  | { kind: "sign"; urgency: number; project: { name: string; slug: string | null; job_number: string | null }; item: NeededSignature }

/**
 * The client's paperwork per published project, live from Sign Here (never stored here).
 * Only projects that carry a job number; only the org's own members' items (see lib/client/sign.ts).
 */
export async function clientSignatures(orgId: string, projects: { id: string; job_number: string | null }[], isStaff: boolean) {
  const out = new Map<string, NeededSignature[]>()
  if (!signingEnabled()) return out
  const members = await db.membership.findMany({
    where: { organization_id: orgId, hidden: false },
    select: { person: { select: { email: true } } },
  })
  const emails = members.map((m) => m.person.email)
  await Promise.all(
    projects
      .filter((p) => p.job_number)
      .map(async (p) => {
        const items = await neededForJob(p.job_number!)
        if (items) out.set(p.id, forClient(items, emails, isStaff))
      }),
  )
  return out
}

/** What needs the client, most urgent first. */
export async function needsYou(
  orgId: string,
  projects: ProjectWithAll[],
  signatures: Map<string, NeededSignature[]> = new Map(),
  myEmail = "",
) {
  const items: NeedsItem[] = []
  // Paper waiting for THIS person (their own email): the most urgent kind of ask.
  for (const p of projects) {
    for (const s of signatures.get(p.id) ?? []) {
      // myEmail "*" = staff viewing as the client: show every member's open paper.
      if (s.status !== "signed" && (myEmail === "*" || s.who.email?.toLowerCase() === myEmail.toLowerCase())) {
        items.push({ kind: "sign", urgency: 1, project: p, item: s })
      }
    }
  }
  const invoices = await orgInvoices(orgId)
  for (const inv of invoices) {
    if (inv.status !== "open") continue
    const n = inv.due_on ? daysFromToday(inv.due_on) : 0
    items.push({ kind: "invoice", urgency: Math.max(0, n), invoice: inv })
  }
  const today = todayUTC()
  for (const p of projects) {
    for (const s of p.shoot_periods) {
      if (s.end_date >= today && daysFromToday(s.start_date) <= 21) {
        items.push({ kind: "shoot", urgency: Math.max(1, daysFromToday(s.start_date)), project: p, shoot: s })
      }
    }
    for (const f of p.deliverables) {
      if (!f.delivered_at && f.review_url) items.push({ kind: "review", urgency: 2, project: p, film: f })
    }
  }
  return items.sort((a, b) => a.urgency - b.urgency)
}
