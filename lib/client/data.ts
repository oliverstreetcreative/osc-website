// Read models for the client pages. Every query is scoped to ONE organization
// id that came from getClientContext() — never from the URL alone.
import { db } from "@/lib/db"
import { daysFromToday, todayUTC } from "./format"

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

/** What needs the client, most urgent first. */
export async function needsYou(orgId: string, projects: ProjectWithAll[]) {
  const items: NeedsItem[] = []
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
