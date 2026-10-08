// Start a project v3, the database side (SPEC §31 v2): one draft per person per org, each screen saved under a row lock
// (two devices can't wipe each other), files reserved under the lock and written to Dropbox outside it, and Send.
// The form itself (questions, parsing, checks, the queue's v5 data) is lib/client/request-form.ts.
import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma"
import type { ClientContext } from "./context"
import { writeNewBinary } from "./dropbox-write"
import { assetsFolder, canRequest, deliver, newFormKey } from "./requests"
import { MAX_FILES, MAX_FILE_BYTES, allProblems, shownName, storedName, type Answers, type ScreenValues, type Step, type StoredFile } from "./request-form"

export const draftSlot = (personId: string, orgId: string) => `${personId}:${orgId}`

export const answersOf = (json: unknown): Answers => (json && typeof json === "object" && !Array.isArray(json) ? (json as Answers) : {})
export const filesOf = (json: unknown): StoredFile[] => (Array.isArray(json) ? (json as StoredFile[]) : [])
/** Files that count as hers: stored, not removed. */
export const liveFiles = (files: StoredFile[]) => files.filter((f) => !f.removed_at && (f as { state?: string }).state !== "uploading" && (f as { state?: string }).state !== "failed")

/** Her open draft for the org she's in, if any. */
export async function currentDraft(ctx: ClientContext) {
  return db.projectRequest.findUnique({ where: { draft_slot: draftSlot(ctx.user.id, ctx.org.id) } })
}

/** One of HER drafts, in the org she's in (anything else is nobody's business here). */
export async function draftFor(ctx: ClientContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return db.projectRequest.findFirst({ where: { id, person_id: ctx.user.id, organization_id: ctx.org.id, status: "draft" } })
}

const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === "P2002"

/** Her draft, made the first time she saves a screen. One per person per org: a race re-reads the winner. */
export async function ensureDraft(ctx: ClientContext) {
  const have = await currentDraft(ctx)
  if (have) return have
  try {
    return await db.projectRequest.create({
      data: {
        organization_id: ctx.org.id,
        person_id: ctx.user.id,
        person_name: ctx.user.name,
        person_email: ctx.user.email,
        form_key: newFormKey(),
        status: "draft",
        form_version: 5,
        answers: {},
        step: "about",
        draft_slot: draftSlot(ctx.user.id, ctx.org.id),
      },
    })
  } catch (e) {
    if (!isUnique(e)) throw e
    const won = await currentDraft(ctx)
    if (!won) throw e
    return won
  }
}

type Tx = Prisma.TransactionClient
const lock = (tx: Tx, id: string) => tx.$queryRaw`SELECT id FROM project_requests WHERE id = ${id}::uuid FOR UPDATE`

/** Save ONE screen's values (that screen's key only) and where she is now. */
export async function saveScreen(id: string, step: Step, values: ScreenValues, at: Step | "review") {
  await db.$transaction(async (tx) => {
    await lock(tx, id)
    const r = await tx.projectRequest.findUnique({ where: { id }, select: { answers: true, status: true } })
    if (!r || r.status !== "draft") return
    const answers = { ...answersOf(r.answers), [step]: values }
    await tx.projectRequest.update({
      where: { id },
      data: {
        answers: answers as Prisma.InputJsonValue,
        step: at,
        ...(step === "assets" ? { assets_later: values.brand_assets_later === true } : {}),
      },
    })
  })
}

export type FileWhy = "type" | "size" | "count" | "state" | "store"
export type FileResult = { ok: true } | { ok: false; why: FileWhy }

/**
 * One file for a request (a draft's assets screen, or "later" after Send). The number is reserved under the lock, the
 * bytes go to Dropbox outside it, and the entry is marked stored or failed. Every file ever reserved counts toward 20.
 */
export async function addFile(
  ctx: ClientContext,
  id: string,
  file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> },
): Promise<FileResult> {
  if (file.bytes.byteLength > MAX_FILE_BYTES) return { ok: false, why: "size" }
  if (file.bytes.byteLength === 0) return { ok: false, why: "type" }
  const reserved = await db.$transaction(async (tx) => {
    await lock(tx, id)
    const r = await tx.projectRequest.findUnique({
      where: { id },
      select: { status: true, assets: true, assets_later: true, organization_id: true, person_id: true, organization: { select: { slug: true } } },
    })
    if (!r || r.organization_id !== ctx.org.id) return { error: "state" as FileWhy }
    const mine = r.person_id === ctx.user.id
    // A draft is hers alone; after Send, "later" uploads come from her or the org's OWNERs and APPROVERs.
    const allowed = r.status === "draft" ? mine : r.assets_later && ["pending", "sent", "in_review"].includes(r.status) && (mine || canRequest(ctx))
    if (!allowed) return { error: "state" as FileWhy }
    const files = filesOf(r.assets)
    if (files.length >= MAX_FILES) return { error: "count" as FileWhy }
    const n = files.length + 1
    const stored = storedName(n, file.name)
    if (!stored) return { error: "type" as FileWhy }
    const entry: StoredFile & { state: string } = {
      n,
      name: shownName(file.name),
      stored,
      type: file.type.slice(0, 100) || "application/octet-stream",
      size: file.bytes.byteLength,
      path: `${assetsFolder(r.organization.slug, id)}/${stored}`,
      at: new Date().toISOString(),
      state: "uploading",
    }
    await tx.projectRequest.update({ where: { id }, data: { assets: [...files, entry] as unknown as Prisma.InputJsonValue } })
    return { entry }
  })
  if (reserved.error || !reserved.entry) return { ok: false, why: reserved.error ?? "state" }
  const entry = reserved.entry
  const written = await writeNewBinary(entry.path, file.bytes)
  const ok = written === "written" // "exists" can't be hers: stored names never repeat, so it's a failure
  await db.$transaction(async (tx) => {
    await lock(tx, id)
    const r = await tx.projectRequest.findUnique({ where: { id }, select: { assets: true } })
    const files = filesOf(r?.assets).map((f) => (f.n === entry.n ? { ...f, state: ok ? "stored" : "failed", ...(ok ? {} : { removed_at: new Date().toISOString() }) } : f))
    await tx.projectRequest.update({ where: { id }, data: { assets: files as unknown as Prisma.InputJsonValue } })
  })
  if (!ok) console.error("client-site requests: upload failed", id, written)
  return ok ? { ok: true } : { ok: false, why: "store" }
}

/** Remove a file from her draft's list (it stays in Dropbox; it still counts toward 20). */
export async function removeFile(ctx: ClientContext, id: string, n: number) {
  await db.$transaction(async (tx) => {
    await lock(tx, id)
    const r = await tx.projectRequest.findUnique({ where: { id }, select: { assets: true, status: true, person_id: true, organization_id: true } })
    if (!r || r.status !== "draft" || r.person_id !== ctx.user.id || r.organization_id !== ctx.org.id) return
    const files = filesOf(r.assets).map((f) => (f.n === n && !f.removed_at ? { ...f, removed_at: new Date().toISOString() } : f))
    await tx.projectRequest.update({ where: { id }, data: { assets: files as unknown as Prisma.InputJsonValue } })
  })
}

const PER_PERSON_PER_DAY = 5
const PER_ORG_PER_DAY = 10

export type SendResult = { ok: true; id: string } | { ok: false; why: "missing"; step: Step } | { ok: false; why: "limit" | "state" }

/** Send her draft: every screen complete, today's limits, then it becomes a request (pending) and is delivered. */
export async function sendDraft(ctx: ClientContext, id: string): Promise<SendResult> {
  if (!canRequest(ctx)) return { ok: false, why: "state" }
  const since = new Date(Date.now() - 86_400_000)
  const sentSince = { OR: [{ sent_at: { gte: since } }, { sent_at: null, created_at: { gte: since } }], status: { not: "draft" } }
  const [mine, theirs] = await Promise.all([
    db.projectRequest.count({ where: { person_id: ctx.user.id, ...sentSince } }),
    db.projectRequest.count({ where: { organization_id: ctx.org.id, ...sentSince } }),
  ])
  const outcome = await db.$transaction(async (tx) => {
    await lock(tx, id)
    const r = await tx.projectRequest.findUnique({ where: { id } })
    if (!r || r.person_id !== ctx.user.id || r.organization_id !== ctx.org.id) return { ok: false as const, why: "state" as const }
    if (r.status !== "draft") return { ok: true as const, id } // a double tap: already sent
    const missing = allProblems(answersOf(r.answers), liveFiles(filesOf(r.assets)).length)
    if (missing.length) return { ok: false as const, why: "missing" as const, step: missing[0].step }
    if (mine >= PER_PERSON_PER_DAY || theirs >= PER_ORG_PER_DAY) return { ok: false as const, why: "limit" as const }
    await tx.projectRequest.update({
      where: { id },
      data: {
        status: "pending",
        sent_at: new Date(),
        draft_slot: null,
        form_version: 5,
        person_name: ctx.user.name,
        person_email: ctx.user.email,
      },
    })
    return { ok: true as const, id, fresh: true }
  })
  if (outcome.ok && "fresh" in outcome) {
    await db.portalEvent
      .create({
        data: {
          person_id: ctx.user.id,
          event_type: "project_request",
          summary: `${ctx.user.name} asked to start a new project`,
          details: { request_id: id, org: ctx.org.slug, form_version: 5 },
          source: "portal_client",
        },
      })
      .catch(() => {})
    void deliver(id).catch((e) => console.error("client-site requests: deliver failed", id, e))
  }
  if (!outcome.ok) return outcome.why === "missing" ? { ok: false, why: "missing", step: outcome.step } : { ok: false, why: outcome.why }
  return { ok: true, id }
}
