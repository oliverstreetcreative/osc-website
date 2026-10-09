// Imported by instrumentation.ts when the Node server boots.
//
// CLIENT SITE: on STAGING (or when CLIENT_SITE_SYNC=1) this
//   1. brings the database schema up to date with `prisma db push` — STAGING
//      ONLY, never with --accept-data-loss, so a destructive change fails loudly
//      instead of dropping data. Production migrations are a deliberate,
//      separate step (see the client-website matter's HANDOFF);
//   2. syncs the client books from Dropbox into Postgres, then every 5 minutes.
// Production does nothing here until CLIENT_SITE_SYNC=1 is set on purpose.
export async function boot() {
  // osc-app (SPEC §33 v2): a bad APP_ORIGIN or FORMS_ORIGIN fails the deploy (Railway keeps the last good one) instead
  // of quietly serving the public site here or breaking every crew link. Nothing is checked where APP_ORIGIN is unset.
  const { appConfigProblem } = await import("../app/routes")
  const problem = appConfigProblem()
  if (problem) {
    console.error(`osc-app: refusing to start: ${problem}`)
    process.exit(1)
  }
  const { IS_STAGING } = await import("../site-env")
  const enabled = IS_STAGING || process.env.CLIENT_SITE_SYNC === "1"
  if (!enabled || !process.env.DATABASE_URL) return

  // osc-app (SPEC §33) starts on its OWN fresh database: CLIENT_SITE_DB_PUSH=1 (set there only) gives it the same
  // create-only schema step staging has, finished before the first sync is scheduled. Next prints "Ready" BEFORE this
  // finishes (staging's boot log, 10/8), so requests can arrive first: /api/health answers 503 until the client site's
  // tables exist, which keeps Railway from sending traffic to a fresh deploy too early. On osc-app a schema that didn't
  // apply stops the boot (v2 review #7).
  const strict = process.env.CLIENT_SITE_DB_PUSH === "1"
  if ((IS_STAGING && process.env.CLIENT_SITE_SKIP_DB_PUSH !== "1") || strict) {
    const ok = await stagingSchema(strict)
    if (!ok && strict) {
      console.error("osc-app: refusing to start: the database schema didn't apply (see the line above)")
      process.exit(1)
    }
  }

  const { syncBooks } = await import("./sync")
  const { deliverRequests } = await import("./requests")
  const run = async () => {
    await syncBooks().catch((err) => console.error("client-site: sync failed", err))
    // "Start a new project" requests: retry delivery to the intake queue, notice pickups (SPEC §17).
    await deliverRequests().catch((err) => console.error("client-site: request delivery failed", err))
    // Cut approvals (SPEC §13): retry any ledger file Dropbox didn't take at approval time (the publish gate reads it).
    const { writePendingLedgers, writePendingHearts, writePendingAcceptances } = await import("./ledger")
    await writePendingLedgers().catch((err) => console.error("client-site: approval ledger retry failed", err))
    // Proposal acceptances (SPEC §24 v2): what Majordomo reads to tell Sam, and the gate's lock.
    await writePendingAcceptances().catch((err) => console.error("client-site: acceptance ledger retry failed", err))
    // Footage hearts (SPEC §23 v2): portal-shaped records for Stacks to import as its client layer.
    await writePendingHearts().catch((err) => console.error("client-site: hearts ledger failed", err))
    // "Something's wrong?" (SPEC §29 v2): sanitized summaries out to Majordomo's intake (retrying any the report's own
    // write missed); status-only files back in.
    // The front door (SPEC §27 P0 v2): counts older than 3 days; session rows that ended more than 90 days ago.
    const { cleanUpFrontDoor } = await import("../auth/door")
    await cleanUpFrontDoor().catch((err) => console.error("sign-in: clean-up failed", err))
    const { mirrorTickets, applyStatusUpdates } = await import("../support/mirror")
    await mirrorTickets().catch((err) => console.error("support: mirror failed", err))
    await applyStatusUpdates().catch((err) => console.error("support: status pickup failed", err))
    // Scripts (SPEC §14): STAGING picks up import files from Dropbox (the rehearsal; production imports through the
    // staff endpoint once Sam puts Scripts on the live site).
    if (IS_STAGING) {
      const { importPendingScripts } = await import("../scripts/server/importer")
      await importPendingScripts().catch((err) => console.error("scripts: import pickup failed", err))
    }
    // Script notices: at most one email per person per 15 minutes (SPEC §14).
    const { sendDueNotices } = await import("../scripts/server/notices")
    await sendDueNotices().catch((err) => console.error("scripts: notices failed", err))
  }
  setTimeout(run, 2_000)
  setInterval(run, 5 * 60_000).unref?.()
}

// STAGING, and osc-app's fresh database (CLIENT_SITE_DB_PUSH=1). Prefer `prisma db push` (no --accept-data-loss). If the prisma
// CLI isn't in the runtime image and the database is EMPTY, apply the
// generated full-schema script prisma/client-site-bootstrap.sql instead (staging only: on osc-app (`strict`) the CLI must
// be there, or every later deploy would leave the schema behind). True = the schema is in place.
async function stagingSchema(strict = false): Promise<boolean> {
  const { existsSync, readFileSync } = await import("fs")
  const { join } = await import("path")
  const bin = join(process.cwd(), "node_modules", ".bin", "prisma")
  if (existsSync(bin)) {
    try {
      const { execFileSync } = await import("child_process")
      const out = execFileSync(bin, ["db", "push", "--skip-generate"], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 120_000,
        encoding: "utf8",
      })
      console.log("client-site: prisma db push:", out.trim().split("\n").slice(-2).join(" | "))
      return true
    } catch (err) {
      console.error("client-site: prisma db push FAILED:", String((err as any)?.stdout ?? err).slice(-800))
      return false
    }
  }
  if (strict) {
    console.error("client-site: the prisma CLI isn't in this image (node_modules/.bin/prisma): the schema can't be applied")
    return false
  }
  try {
    const pg = (await import("pg")).default
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const { rows } = await client.query("select to_regclass('public.people') as t")
    let ok = true
    if (!rows[0]?.t) {
      await client.query(readFileSync(join(process.cwd(), "prisma", "client-site-bootstrap.sql"), "utf8"))
      console.log("client-site: empty database bootstrapped from client-site-bootstrap.sql")
    } else {
      console.warn("client-site: prisma CLI missing and database not empty; schema NOT updated")
      ok = false
    }
    await client.end()
    return ok
  } catch (err) {
    console.error("client-site: SQL bootstrap failed:", err)
    return false
  }
}
