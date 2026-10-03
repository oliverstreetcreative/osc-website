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
  const { IS_STAGING } = await import("../site-env")
  const enabled = IS_STAGING || process.env.CLIENT_SITE_SYNC === "1"
  if (!enabled || !process.env.DATABASE_URL) return

  if (IS_STAGING && process.env.CLIENT_SITE_SKIP_DB_PUSH !== "1") await stagingSchema()

  const { syncBooks } = await import("./sync")
  const { deliverRequests } = await import("./requests")
  const run = async () => {
    await syncBooks().catch((err) => console.error("client-site: sync failed", err))
    // "Start a new project" requests: retry delivery to the intake queue, notice pickups (SPEC §17).
    await deliverRequests().catch((err) => console.error("client-site: request delivery failed", err))
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

// STAGING ONLY. Prefer `prisma db push` (no --accept-data-loss). If the prisma
// CLI isn't in the runtime image and the database is EMPTY, apply the
// generated full-schema script prisma/client-site-bootstrap.sql instead.
async function stagingSchema() {
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
      return
    } catch (err) {
      console.error("client-site: prisma db push FAILED:", String((err as any)?.stdout ?? err).slice(-800))
      return
    }
  }
  try {
    const pg = (await import("pg")).default
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const { rows } = await client.query("select to_regclass('public.people') as t")
    if (!rows[0]?.t) {
      await client.query(readFileSync(join(process.cwd(), "prisma", "client-site-bootstrap.sql"), "utf8"))
      console.log("client-site: empty database bootstrapped from client-site-bootstrap.sql")
    } else {
      console.warn("client-site: prisma CLI missing and database not empty; schema NOT updated")
    }
    await client.end()
  } catch (err) {
    console.error("client-site: SQL bootstrap failed:", err)
  }
}
