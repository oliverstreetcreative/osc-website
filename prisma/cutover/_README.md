# prisma/cutover 🤖

The client site's production schema change (client-website SPEC §26 v2), kept for review. Created 2026-10-04 by the
`client-website` worker.

**Why it exists:** production runs `next start` with no migrations and no schema step at boot (only staging runs
`prisma db push`), and its schema was applied by hand. So the cut-over applies ONE reviewed SQL file, in one
transaction, after a backup and a drift check, never `db push`.

**`client-site.sql`** was generated from `origin/main`'s `prisma/schema.prisma` to this branch's (`prisma migrate
diff --from-schema-datamodel … --to-schema-datamodel … --script`). What it does:
- creates 21 tables (organizations, memberships, invoices, documents, project requests, version approvals, proposal
  acceptances and views, libraries, library clips and hearts, and the ten Scripts tables) and one enum (`MemberRole`);
- adds columns to existing tables (`people`, `projects`, `deliverables`, `shoot_periods`): every new NOT NULL column
  has a constant default, so it's a metadata-only change on a filled table;
- relaxes `NOT NULL` on the retired Bible columns (`source_bible_id`, `source_bible_table`; 8 lines) — the only
  "DROP" in the file;
- adds indexes and foreign keys only on new tables or new columns.
Nothing is dropped or rewritten; the old code keeps working against the new schema.

**At cut-over** (Majordomo, `scripts/cutover_check.py`): restore a fresh production backup into a scratch database
→ `drift` (it must be exactly main's schema) → `generate` from that copy and compare with this file (any difference
stops the run) → apply with `psql --single-transaction -v ON_ERROR_STOP=1` and `SET lock_timeout = '5s'` → `verify`
(exit 0) → `staff` and `people` (read-only queries; their rows go on Sam's go-live ticket) → then the same on
production. Regenerate this file whenever `prisma/schema.prisma` changes before cut-over. Never edit it by hand.

**`rollback-backfill.sql`** is written in advance so a bad night is a paste, not an improvisation. It's needed only to roll
the CODE back to the old `main` after the client site's first sync: old main can't read the NULL Bible ids the client
site leaves on people, projects, films and shoots (Prisma P2032), so it stamps them the way old main stamps
portal-born rows (`0`, `'client-site'`). Going dark never needs it; that's `UPDATE organizations SET hidden = true`.

Live status: `Matters/client-website/HANDOFF.md`.
