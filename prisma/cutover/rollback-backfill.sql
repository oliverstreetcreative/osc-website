-- 🤖 client-website SPEC §26 v2, rollback step 2. Run ONLY before rolling the CODE back to the pre-client-site `main`
-- AFTER the client site's first sync. Going dark never needs it (that's `UPDATE organizations SET hidden = true`).
--
-- Why: the client site creates people, projects, films and shoots without the retired Bible ids (the cut-over SQL made
-- those columns nullable on these four tables). Old main's Prisma client can't read a NULL there (P2032: every admin
-- page that lists them breaks). This fills the gaps the way old main itself stamps portal-born rows (id 0, a table
-- word). Additive and safe to run twice; the schema itself stays as it is.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE people        SET source_bible_id = COALESCE(source_bible_id, 0), source_bible_table = COALESCE(source_bible_table, 'client-site')
 WHERE source_bible_id IS NULL OR source_bible_table IS NULL;
UPDATE projects      SET source_bible_id = COALESCE(source_bible_id, 0), source_bible_table = COALESCE(source_bible_table, 'client-site')
 WHERE source_bible_id IS NULL OR source_bible_table IS NULL;
UPDATE deliverables  SET source_bible_id = COALESCE(source_bible_id, 0), source_bible_table = COALESCE(source_bible_table, 'client-site')
 WHERE source_bible_id IS NULL OR source_bible_table IS NULL;
UPDATE shoot_periods SET source_bible_id = COALESCE(source_bible_id, 0), source_bible_table = COALESCE(source_bible_table, 'client-site')
 WHERE source_bible_id IS NULL OR source_bible_table IS NULL;
COMMIT;
