// Book → Postgres. Reads every PUBLISHED client book from Dropbox and upserts it
// by stable keys. Anything that disappears from a book is HIDDEN, never deleted.
//
// THE PUBLISH GATE (Sam 10/3 00:55; spine 01:20): workers write drafts in
// books/, which this site NEVER reads. Only scripts/client_gate.py writes
// published/, and only on Sam's approval. preview/ holds "<org>--preview"
// books (published + pending items) that only OSC staff can open, via View as
// client; they never carry people, so no client can sign in to one.
// On top of that, failClosed() drops any item whose text carries an internal
// marker, so a bad edit renders as nothing rather than as a leak.
import { db } from "@/lib/db"
import { Book } from "./book"
import { listJson, readText } from "./dropbox"
import { DEMO_ORG_SLUG, demoBook, demoOn, isDemoSlug } from "./demo"
import { syncLibraries } from "./library"
import { IS_PRODUCTION, IS_STAGING } from "@/lib/site-env"

export const PUBLISHED_FOLDER = "/_admin/client-site/published"
export const PREVIEW_FOLDER = "/_admin/client-site/preview"
/** @deprecated drafts; the site never reads them */
export const BOOKS_FOLDER = PUBLISHED_FOLDER

// A stricter subset of the gate's lint (scripts/client_gate.py), checked again at render time. Only markers
// that never belong in client copy, so a legit title like "Internal Comms Video" is never hidden.
const INTERNAL = [
  /🤖/u,
  /\bPRELIM\d*\b/,
  /\bDO NOT (SEND|SHARE)\b/i,
  /\b(HANDOFF|Majordomo|project\.json|PENDING-RULINGS)\b/,
  /\b(day rate|rate card|crew pay|our cost|net profit)\b/i,
  /\brouting number\b/i,
]
const isInternal = (x: unknown): boolean => {
  const s = JSON.stringify(x ?? "")
  return INTERNAL.some((r) => r.test(s))
}

/** Fail closed: drop (and report) any item whose text carries an internal marker. */
export function failClosed(book: Book, dropped: string[]): Book {
  const keep = <T,>(label: string, items: T[], strip: (t: T) => unknown = (t) => t) =>
    items.filter((t) => {
      const bad = isInternal(strip(t))
      if (bad) dropped.push(label)
      return !bad
    })
  return {
    ...book,
    projects: keep("project", book.projects, (p) => ({ ...p, films: [], shoots: [] })).map((p) => ({
      ...p,
      films: keep(`film in ${p.key}`, p.films),
      shoots: keep(`shoot in ${p.key}`, p.shoots),
    })),
    invoices: keep("invoice", book.invoices, (i) => ({ ...i, memo: undefined })),
    documents: keep("document", book.documents),
  }
}
// OSC staff who may sign in and use "View as client". Same allowlist idea as the
// books: a staff identity exists on the site only because it's in this file.
export const STAFF_FILE = "/_admin/client-site/staff.json"

async function applyStaff() {
  let raw: string
  try {
    raw = await readText(STAFF_FILE)
  } catch {
    return // no staff file yet: nothing to do
  }
  const body = JSON.parse(raw) as { version: number; staff: { email: string; name: string; first_name?: string }[] }
  for (const s of body.staff ?? []) {
    const email = s.email.trim().toLowerCase()
    if (!email.endsWith("@oliverstreetcreative.com")) continue // staff are OSC addresses, always
    await db.person.upsert({
      where: { email },
      create: { email, name: s.name, first_name: s.first_name, role: "STAFF", is_staff: true, portal_allowed: true },
      update: { name: s.name, first_name: s.first_name ?? null, role: "STAFF", is_staff: true, portal_allowed: true },
    })
  }
}

const d = (s?: string | null) => (s ? new Date(`${s}T12:00:00Z`) : null)

export type SyncReport = { ok: string[]; failed: { file: string; error: string }[]; at: string }

let running: Promise<SyncReport> | null = null
export let lastSync: SyncReport | null = null

export function syncBooks(): Promise<SyncReport> {
  if (!running) {
    running = doSync().finally(() => {
      running = null
    })
  }
  return running
}

async function doSync(): Promise<SyncReport> {
  const report: SyncReport = { ok: [], failed: [], at: new Date().toISOString() }
  try {
    await applyStaff()
  } catch (err) {
    report.failed.push({ file: STAFF_FILE, error: String((err as Error)?.message ?? err).slice(0, 300) })
  }
  // The staging demo (SPEC §19) goes FIRST: its data comes from the repo, so a Dropbox failure below can't stop it.
  // Applied only while demoOn() (staging + CLIENT_DEMO_TOKEN). Only a DEPLOYED server ever hides demo orgs: a sync
  // run from a Mac (scripts/client-sync.ts, IS_STAGING false) leaves them exactly as they are.
  const demo = demoOn()
  const deployed = IS_STAGING || IS_PRODUCTION
  if (demo) {
    try {
      const dropped: string[] = []
      await applyBook(failClosed(demoBook(), dropped))
      if (dropped.length) report.failed.push({ file: "demo", error: `held back (internal marker): ${dropped.join(", ")}` })
      report.ok.push(DEMO_ORG_SLUG)
    } catch (err) {
      report.failed.push({ file: "demo", error: String((err as Error)?.message ?? err).slice(0, 500) })
    }
  } else if (deployed) {
    await db.organization.updateMany({ where: { slug: { startsWith: "demo-" }, hidden: false }, data: { hidden: true } })
  }

  const published = await listJson(PUBLISHED_FOLDER)
  const previews = await listJson(PREVIEW_FOLDER).catch(() => [] as string[])
  const files = [...published, ...previews]
  const seen = new Set<string>()
  for (const file of files) {
    try {
      const parsed = Book.safeParse(JSON.parse(await readText(file)))
      if (!parsed.success) {
        throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "))
      }
      let book = parsed.data
      const slug = book.org.slug
      const isPreview = previews.includes(file)
      if (file.split("/").pop() !== `${slug}.json`) throw new Error(`file name must be ${slug}.json`)
      if (isPreview !== slug.endsWith("--preview")) throw new Error("preview books (and only they) end in --preview")
      if (isDemoSlug(slug)) throw new Error("demo- slugs belong to the staging demo (lib/client/demo.ts), never a Dropbox book")
      if (isPreview) book = { ...book, people: [] } // nobody signs in to a preview; staff open it via View as client
      if (seen.has(slug)) throw new Error(`duplicate org slug ${slug}`)
      seen.add(slug)
      const dropped: string[] = []
      book = failClosed(book, dropped)
      if (dropped.length) report.failed.push({ file, error: `held back (internal marker): ${dropped.join(", ")}` })
      await applyBook(book)
      // Footage from Stacks (SPEC §23 v2): the gate's frozen library snapshots for this org (preview orgs: pending ones).
      for (const problem of await syncLibraries(slug, isPreview)) report.failed.push({ file: `library: ${slug}`, error: problem })
      report.ok.push(slug)
    } catch (err) {
      report.failed.push({ file, error: String((err as Error)?.message ?? err).slice(0, 500) })
    }
  }
  // A book that disappeared revokes its org (hidden, never deleted). Only when the listing itself worked and found
  // at least one REAL book. Demo orgs are never swept here: the switch above alone decides them.
  if (files.length && seen.size) {
    await db.organization.updateMany({
      where: { slug: { notIn: [...seen] }, hidden: false, NOT: { slug: { startsWith: "demo-" } } },
      data: { hidden: true },
    })
  }
  lastSync = report
  console.log("client-site sync:", JSON.stringify(report))
  return report
}

export async function applyBook(book: Book) {
  const o = book.org
  const org = await db.organization.upsert({
    where: { slug: o.slug },
    create: {
      slug: o.slug, name: o.name, short_name: o.short_name, logo_path: o.logo, website: o.website,
      billing_email: o.billing_email,
    },
    update: {
      name: o.name, short_name: o.short_name ?? null, logo_path: o.logo ?? null, website: o.website ?? null,
      billing_email: o.billing_email ?? null, hidden: false, synced_at: new Date(),
    },
  })

  // People + memberships
  const keepMembers: string[] = []
  for (const p of book.people) {
    const email = p.email.trim().toLowerCase()
    const existing = await db.person.findUnique({ where: { email } })
    const person = existing
      ? existing.is_staff
        ? existing // never rewrite a staff identity from a client book
        : await db.person.update({ where: { email }, data: { name: p.name, first_name: p.first_name ?? null, portal_allowed: true } })
      : await db.person.create({
          data: { email, name: p.name, first_name: p.first_name, role: "CLIENT", company: o.name, portal_allowed: true },
        })
    const m = await db.membership.upsert({
      where: { organization_id_person_id: { organization_id: org.id, person_id: person.id } },
      create: { organization_id: org.id, person_id: person.id, role: p.role, title: p.title },
      update: { role: p.role, title: p.title ?? null, hidden: false },
    })
    keepMembers.push(m.id)
  }
  await db.membership.updateMany({
    where: { organization_id: org.id, id: { notIn: keepMembers } },
    data: { hidden: true },
  })

  // Projects, films, shoots
  const projectIdByKey = new Map<string, string>()
  const keepProjects: string[] = []
  const keepFilms: string[] = []
  const keepShoots: string[] = []
  for (const p of book.projects) {
    const ext = `${o.slug}/${p.key}`
    const data = {
      name: p.title,
      job_number: p.job_number ?? null,
      phase: p.phase,
      status: p.phase === "paid" || p.phase === "delivered" ? "complete" : "active",
      client_portal_enabled: true,
      client_visible: true,
      organization_id: org.id,
      slug: p.slug,
      kind: p.kind ?? null,
      summary: p.summary ?? null,
      status_line: p.status_line ?? null,
      next_step: p.next_step ?? null,
      poster_mux_id: p.poster?.mux_playback_id ?? p.films.find((f) => f.mux_playback_id)?.mux_playback_id ?? null,
      poster_time: p.poster?.time ?? p.films.find((f) => f.mux_playback_id)?.poster_time ?? null,
      poster_path: p.poster?.path ?? p.films.find((f) => f.poster)?.poster ?? null,
      dates: p.dates,
      team: p.team,
      sort_date: d(p.sort_date),
      from_request: p.from_request ?? null,
      hidden: false,
    }
    const proj = await db.project.upsert({ where: { ext_key: ext }, create: { ext_key: ext, ...data }, update: data })
    projectIdByKey.set(p.key, proj.id)
    keepProjects.push(ext)

    for (const [i, f] of p.films.entries()) {
      const fx = `${ext}/${f.key}`
      const fd = {
        project_id: proj.id,
        name: f.title,
        deliverable_type: "video",
        description: f.description ?? null,
        client_visible: true,
        review_status: f.delivered_on ? "Delivered" : f.review_url ? "Pending Review" : "Not Ready",
        mux_playback_id: f.mux_playback_id ?? null,
        file_path: f.file ?? null,
        poster_path: f.poster ?? null,
        aspect: f.aspect ?? null,
        poster_time: f.poster_time ?? null,
        duration_s: f.duration_s ?? null,
        version_label: f.version ?? null,
        watch_url: f.watch_url ?? null,
        review_url: f.review_url ?? null,
        review_asset_id: f.review_asset_id ?? null,
        version_review_id: f.version_review_id ?? null,
        approvers: f.approvers.map((e) => e.toLowerCase()),
        approval: f.approval,
        ask: f.ask,
        downloads: f.downloads,
        delivered_at: d(f.delivered_on),
        shared_at: d(f.delivered_on),
        sort: i,
        hidden: false,
      }
      await db.deliverable.upsert({ where: { ext_key: fx }, create: { ext_key: fx, ...fd }, update: fd })
      keepFilms.push(fx)
    }
    for (const s of p.shoots) {
      const sx = `${ext}/${s.key}`
      const sd = {
        project_id: proj.id,
        description: s.label ?? null,
        start_date: d(s.start)!,
        end_date: d(s.end ?? s.start)!,
        period_type: "shoot",
        call_time: s.call_time ?? null,
        client_visible: true,
        location: s.location ?? null,
        address: s.address ?? null,
        bring: s.bring ?? null,
        hidden: false,
      }
      await db.shootPeriod.upsert({ where: { ext_key: sx }, create: { ext_key: sx, ...sd }, update: sd })
      keepShoots.push(sx)
    }
  }
  const prefix = `${o.slug}/`
  await db.project.updateMany({ where: { ext_key: { startsWith: prefix, notIn: keepProjects } }, data: { hidden: true } })
  await db.deliverable.updateMany({ where: { ext_key: { startsWith: prefix, notIn: keepFilms } }, data: { hidden: true } })
  await db.shootPeriod.updateMany({ where: { ext_key: { startsWith: prefix, notIn: keepShoots } }, data: { hidden: true } })

  // Invoices
  const keepInvoices: string[] = []
  for (const inv of book.invoices) {
    const data = {
      organization_id: org.id,
      project_id: inv.project_key ? projectIdByKey.get(inv.project_key) ?? null : null,
      title: inv.title,
      amount: inv.amount,
      issued_on: d(inv.issued_on)!,
      due_on: d(inv.due_on),
      paid_on: d(inv.paid_on),
      status: inv.status,
      pay_url: inv.pay_url ?? null,
      pdf_path: inv.pdf ?? null,
      memo: null, // never shown to clients; not stored until it's gated, rendered text

      hidden: false,
    }
    const existing = await db.invoice.findUnique({ where: { number: inv.number }, select: { organization_id: true } })
    if (existing && existing.organization_id !== org.id) {
      throw new Error(`invoice ${inv.number} already belongs to another client; fix the book`)
    }
    await db.invoice.upsert({ where: { number: inv.number }, create: { number: inv.number, ...data }, update: data })
    keepInvoices.push(inv.number)
  }
  await db.invoice.updateMany({ where: { organization_id: org.id, number: { notIn: keepInvoices } }, data: { hidden: true } })

  // Documents
  const keepDocs: string[] = []
  for (const doc of book.documents) {
    const ext = `${o.slug}/${doc.key}`
    const data = {
      organization_id: org.id,
      project_id: doc.project_key ? projectIdByKey.get(doc.project_key) ?? null : null,
      kind: doc.kind,
      title: doc.title,
      description: doc.description ?? null,
      dated_on: d(doc.dated_on),
      dropbox_path: doc.path ?? null,
      url: doc.url ?? null,
      signed_by: doc.signed_by ?? null,
      signed_on: d(doc.signed_on),
      mime_type: doc.path?.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
      hidden: false,
    }
    await db.document.upsert({ where: { ext_key: ext }, create: { ext_key: ext, ...data }, update: data })
    keepDocs.push(ext)
  }
  // Only rows the BOOK owns (ext_key "<org>/<key>") are hidden here: a document born in the portal (an approval
  // receipt, a script export) has its own key and is never the sync's to touch (migration review 10/3: one writer per
  // fact). Invoices and memberships are still book-owned whole families; when portal-born rows of either exist, give
  // them the same treatment first.
  await db.document.updateMany({
    where: { organization_id: org.id, ext_key: { startsWith: prefix, notIn: keepDocs } },
    data: { hidden: true },
  })
}
