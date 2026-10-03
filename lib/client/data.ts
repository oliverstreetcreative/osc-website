// Read models for the client pages. Every query is scoped to ONE organization
// id that came from getClientContext() — never from the URL alone.
import { db } from "@/lib/db"
import { daysFromToday, todayUTC } from "./format"
import { neededForJob, forClient, isDone, signingEnabled, type NeededSignature, type SignViewer } from "./sign"
import { isDemoSlug } from "./demo"

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
  | { kind: "script"; urgency: number; script: { id: string; title: string; status: string } }
  | { kind: "invoice"; urgency: number; invoice: Awaited<ReturnType<typeof orgInvoices>>[number] }
  | { kind: "shoot"; urgency: number; project: ProjectWithAll; shoot: ProjectWithAll["shoot_periods"][number] }
  | { kind: "review"; urgency: number; project: ProjectWithAll; film: ProjectWithAll["deliverables"][number] }
  | { kind: "sign"; urgency: number; project: { name: string; slug: string | null; job_number: string | null }; item: NeededSignature }

/** The client's paperwork, live from Sign Here (never stored here): per project, or "unavailable". */
export type ClientPaper = {
  /** False while signing is dormant (no env) or for orgs with no published book (the demo, previews). */
  enabled: boolean
  /** Project ids whose read failed (503 = signing isn't set up for this org, a timeout, a bad shape). */
  unavailable: Set<string>
  byProject: Map<string, NeededSignature[]>
}

/**
 * Contract v2: the engine returns only the viewer's OWN client-kind paper (staff viewing as the client: every
 * member's, read-only). Only projects that carry a job number. A failed read is "unavailable", never "all set".
 */
export async function clientSignatures(
  org: { slug: string },
  projects: { id: string; job_number: string | null }[],
  viewer: SignViewer,
): Promise<ClientPaper> {
  const out: ClientPaper = { enabled: false, unavailable: new Set(), byProject: new Map() }
  // The demo and preview orgs have no published book, so the engine would always answer 503: show nothing there.
  if (!signingEnabled() || isDemoSlug(org.slug) || org.slug.endsWith("--preview")) return out
  out.enabled = true
  await Promise.all(
    projects
      .filter((p) => p.job_number)
      .map(async (p) => {
        const res = await neededForJob(p.job_number!, org.slug, viewer)
        if (!res) return
        if (!res.ok) out.unavailable.add(p.id)
        else out.byProject.set(p.id, forClient(res.items, viewer))
      }),
  )
  return out
}

/** What needs the client, most urgent first. */
/** Scripts this org (or this person) can open: shared by Sam, not archived (SPEC §14). */
export function visibleScriptsWhere(orgId: string, personId?: string) {
  const now = new Date()
  return {
    archived_at: null,
    audience: { not: "office" },
    access: {
      some: {
        revoked_at: null,
        AND: [
          { OR: [{ organization_id: orgId }, ...(personId ? [{ person_id: personId }] : [])] },
          { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
        ],
      },
    },
  }
}

export async function needsYou(
  orgId: string,
  projects: ProjectWithAll[],
  signatures: ClientPaper = { enabled: false, unavailable: new Set(), byProject: new Map() },
  personId?: string,
) {
  const items: NeedsItem[] = []
  // Scripts Sam marked ready for their notes or their OK (SPEC §14 phone moment 3).
  const scripts = await db.script.findMany({
    where: { ...visibleScriptsWhere(orgId, personId), status: { in: ["ready_for_notes", "ready_for_ok"] } },
    select: { id: true, title: true, status: true },
    orderBy: { updated_at: "desc" },
  })
  for (const s of scripts) items.push({ kind: "script", urgency: s.status === "ready_for_ok" ? 1 : 2, script: s })
  // Paper waiting for this person (the engine already returned only their own; staff viewing see every member's).
  for (const p of projects) {
    for (const s of signatures.byProject.get(p.id) ?? []) {
      if (!isDone(s) && s.state !== "awaiting_countersign") {
        items.push({ kind: "sign", urgency: s.overdue ? 0 : 1, project: p, item: s })
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
