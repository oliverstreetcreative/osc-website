// Read models for the client pages. Every query is scoped to ONE organization
// id that came from getClientContext() — never from the URL alone.
import { db } from "@/lib/db"
import { daysFromToday, todayUTC } from "./format"
import { neededForJob, forClient, needsSigning, signOrgFor, signingEnabled, type NeededSignature, type SignViewer } from "./sign"
import { isApprover, reviewState } from "./approvals"

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
  | { kind: "review"; urgency: number; project: ProjectWithAll; film: ProjectWithAll["deliverables"][number]; version_n?: number }
  | { kind: "sign"; urgency: number; project: { name: string; slug: string | null; job_number: string | null }; item: NeededSignature }
  | { kind: "proposal"; urgency: number; doc: { id: string; title: string; good_until: Date | null }; project: { name: string } | null }

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
  // Orgs that don't ask show nothing: the demo and preview orgs (no published book), and on STAGING every org but the
  // signing twin (staging's engine holds no real books). signOrgFor (sign.ts) decides, SPEC §22 v2.1.
  if (!signingEnabled() || !signOrgFor(org.slug)) return out
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
  /** The signed-in client's email (undefined while staff view the site: they see every approver's asks). */
  email?: string,
  /** Their role in this org: VIEWERs see no money, so no proposals (SPEC §10.5b, §24 v2). */
  role?: string,
) {
  const items: NeedsItem[] = []
  // Scripts Sam marked ready for their notes or their OK (SPEC §14 phone moment 3).
  const scripts = await db.script.findMany({
    where: { ...visibleScriptsWhere(orgId, personId), status: { in: ["ready_for_notes", "ready_for_ok"] } },
    select: { id: true, title: true, status: true },
    orderBy: { updated_at: "desc" },
  })
  for (const s of scripts) items.push({ kind: "script", urgency: s.status === "ready_for_ok" ? 1 : 2, script: s })
  // Paper waiting for this person (the engine already returned only their own; staff viewing see every member's):
  // Sign Here's rule, `status !== "signed"`, and only what they can start now (SPEC §22 v2.1).
  for (const p of projects) {
    for (const s of signatures.byProject.get(p.id) ?? []) {
      if (needsSigning(s)) {
        items.push({ kind: "sign", urgency: s.overdue ? 0 : 1, project: p, item: s })
      }
    }
  }
  // A proposal waiting for this person's yes (SPEC §24 v2): its named acceptors only (staff viewing see them, read-only),
  // until it's accepted or past its good-until date.
  const proposals = role === "VIEWER" ? [] : await db.document.findMany({
    where: { organization_id: orgId, hidden: false, kind: "proposal", ask: "accept", sha256: { not: null }, acceptance: null, OR: [{ project_id: null }, { project: { hidden: false } }] },
    select: { id: true, title: true, good_until: true, acceptors: true, project: { select: { name: true } } },
  })
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  for (const d of proposals) {
    if (d.good_until && d.good_until.toISOString().slice(0, 10) < todayET) continue
    const list = Array.isArray(d.acceptors) ? d.acceptors.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase()) : []
    if (email && !list.includes(email.toLowerCase())) continue
    items.push({ kind: "proposal", urgency: 1, doc: { id: d.id, title: d.title, good_until: d.good_until }, project: d.project })
  }
  const invoices = await orgInvoices(orgId)
  for (const inv of invoices) {
    if (inv.status !== "open") continue
    const n = inv.due_on ? daysFromToday(inv.due_on) : 0
    items.push({ kind: "invoice", urgency: Math.max(0, n), invoice: inv })
  }
  const today = todayUTC()
  const okAsks: { p: ProjectWithAll; f: ProjectWithAll["deliverables"][number] }[] = []
  for (const p of projects) {
    for (const s of p.shoot_periods) {
      if (s.end_date >= today && daysFromToday(s.start_date) <= 21) {
        items.push({ kind: "shoot", urgency: Math.max(1, daysFromToday(s.start_date)), project: p, shoot: s })
      }
    }
    // A cut in review shows only when Sam asks (SPEC §13 v3): notes (everyone), or an OK (the film's approvers; staff
    // viewing see it read-only), until the newest version is approved or this person has approved it.
    for (const f of p.deliverables) {
      if (f.delivered_at || !f.review_url) continue
      if (f.ask === "notes") items.push({ kind: "review", urgency: 2, project: p, film: f })
      if (f.ask === "ok" && (!email || isApprover(f, email))) okAsks.push({ p, f })
    }
  }
  // Read in parallel: a slow Review costs the home page one wait, not one per film.
  const states = await Promise.all(okAsks.map(({ f }) => reviewState(f)))
  okAsks.forEach(({ p, f }, i) => {
    const st = states[i]
    const mine = !!email && st.kind === "ok" && st.approvals.some((a) => a.version_id === st.newest.id && a.email === email.toLowerCase())
    if (st.kind === "ok" && (st.newestApproved || mine)) return
    items.push({ kind: "review", urgency: 1, project: p, film: f, version_n: st.kind === "ok" ? st.newest.n : undefined })
  })
  return items.sort((a, b) => a.urgency - b.urgency)
}
