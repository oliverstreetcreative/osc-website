// 🤖 client-website SPEC §26 v2, steps A3 / B3 / D2: can OLD code read this database?
// Reads up to 50 rows of every model with a given Prisma client (old main's: run `npx prisma generate` in a checkout of
// main, then pass its generated/prisma folder) against the database in CUTOVER_DB_URL (the environment, never argv).
//
//   node scripts/cutover_old_reads.mjs ~/code/osc-website-hotfix/generated/prisma
//
// Exit 0 = every model read. Exit 1 = a model failed: P2032 means a NULL old main can't read (after the client site's
// first sync, that's the Bible ids: run prisma/cutover/rollback-backfill.sql, then this again). Prints no row data.
import { createRequire } from "module"
import path from "path"

const dir = process.argv[2]
if (!dir || !process.env.CUTOVER_DB_URL) {
  console.error("usage: CUTOVER_DB_URL in the environment; node scripts/cutover_old_reads.mjs <generated prisma client dir>")
  process.exit(2)
}
const require = createRequire(import.meta.url)
const { PrismaClient, Prisma } = require(path.resolve(dir))
const db = new PrismaClient({ datasourceUrl: process.env.CUTOVER_DB_URL })
let failed = 0
for (const name of Object.values(Prisma.ModelName)) {
  const key = name[0].toLowerCase() + name.slice(1)
  try {
    const rows = await db[key].findMany({ take: 50 })
    console.log(`ok    ${name} (${rows.length})`)
  } catch (err) {
    failed++
    const last = String(err?.message ?? err).trim().split("\n").pop().slice(0, 200)
    console.log(`FAIL  ${name}: ${err?.code ?? ""} ${last}`)
  }
}
await db.$disconnect().catch(() => {})
console.log(failed ? `${failed} model(s) failed` : "every model read")
process.exit(failed ? 1 : 0)
