-- 🤖 ROLLBACK OF THE CUT-OVER SCHEMA (client-website SPEC §26 v3), for ONE window only: after A4 applied
-- client-site.sql and BEFORE production has ever run the client site (no release deploy, or it was reverted, and
-- CLIENT_SITE_SYNC never set). It drops the 24 new tables and the columns client-site.sql added, and puts back the
-- old NOT NULLs on the Bible ids. Once the release has served traffic (sign-ins write new session columns) or a sync
-- has run (NULL Bible ids exist), this is the WRONG file: use D1/D2 (go dark, rollback-backfill.sql) or D3 (restore).
-- Generated 10/8 with: prisma migrate diff --from-schema-datamodel <release schema> --to-schema-datamodel <main's>.
-- Apply exactly like client-site.sql: PGOPTIONS='-c lock_timeout=5s' psql --single-transaction -v ON_ERROR_STOP=1 -f …
-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_person_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_project_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_acceptances" DROP CONSTRAINT "proposal_acceptances_document_id_fkey";

-- DropForeignKey
ALTER TABLE "project_requests" DROP CONSTRAINT "project_requests_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "project_requests" DROP CONSTRAINT "project_requests_person_id_fkey";

-- DropForeignKey
ALTER TABLE "version_approvals" DROP CONSTRAINT "version_approvals_deliverable_id_fkey";

-- DropForeignKey
ALTER TABLE "libraries" DROP CONSTRAINT "libraries_project_id_fkey";

-- DropForeignKey
ALTER TABLE "library_clips" DROP CONSTRAINT "library_clips_library_id_fkey";

-- DropForeignKey
ALTER TABLE "library_hearts" DROP CONSTRAINT "library_hearts_clip_id_fkey";

-- DropForeignKey
ALTER TABLE "scripts" DROP CONSTRAINT "scripts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scripts" DROP CONSTRAINT "scripts_project_id_fkey";

-- DropForeignKey
ALTER TABLE "scripts" DROP CONSTRAINT "scripts_deliverable_id_fkey";

-- DropForeignKey
ALTER TABLE "script_updates" DROP CONSTRAINT "script_updates_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_snapshots" DROP CONSTRAINT "script_snapshots_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_clients" DROP CONSTRAINT "script_clients_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_clients" DROP CONSTRAINT "script_clients_person_id_fkey";

-- DropForeignKey
ALTER TABLE "script_versions" DROP CONSTRAINT "script_versions_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_access" DROP CONSTRAINT "script_access_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_access" DROP CONSTRAINT "script_access_person_id_fkey";

-- DropForeignKey
ALTER TABLE "script_access" DROP CONSTRAINT "script_access_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "script_invites" DROP CONSTRAINT "script_invites_access_id_fkey";

-- DropForeignKey
ALTER TABLE "script_comments" DROP CONSTRAINT "script_comments_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_approvals" DROP CONSTRAINT "script_approvals_script_id_fkey";

-- DropForeignKey
ALTER TABLE "script_notices" DROP CONSTRAINT "script_notices_person_id_fkey";

-- DropForeignKey
ALTER TABLE "script_notices" DROP CONSTRAINT "script_notices_script_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_person_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "support_attachments" DROP CONSTRAINT "support_attachments_ticket_id_fkey";

-- DropIndex
DROP INDEX "people_calendar_token_key";

-- DropIndex
DROP INDEX "projects_ext_key_key";

-- DropIndex
DROP INDEX "deliverables_ext_key_key";

-- DropIndex
DROP INDEX "shoot_periods_ext_key_key";

-- DropIndex
DROP INDEX "portal_invites_person_id_accepted_at_idx";

-- DropIndex
DROP INDEX "portal_sessions_person_id_revoked_at_idx";

-- DropIndex
DROP INDEX "portal_sessions_person_id_device_hash_idx";

-- AlterTable
ALTER TABLE "people" DROP COLUMN "calendar_token",
ALTER COLUMN "source_bible_id" SET NOT NULL,
ALTER COLUMN "source_bible_table" SET NOT NULL,
ALTER COLUMN "published_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "dates",
DROP COLUMN "ext_key",
DROP COLUMN "from_request",
DROP COLUMN "hidden",
DROP COLUMN "kind",
DROP COLUMN "money",
DROP COLUMN "next_step",
DROP COLUMN "organization_id",
DROP COLUMN "poster_mux_id",
DROP COLUMN "poster_path",
DROP COLUMN "poster_time",
DROP COLUMN "slug",
DROP COLUMN "sort_date",
DROP COLUMN "status_line",
DROP COLUMN "summary",
DROP COLUMN "team",
ALTER COLUMN "source_bible_id" SET NOT NULL,
ALTER COLUMN "source_bible_table" SET NOT NULL,
ALTER COLUMN "published_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "deliverables" DROP COLUMN "approval",
DROP COLUMN "approvers",
DROP COLUMN "ask",
DROP COLUMN "aspect",
DROP COLUMN "delivered_at",
DROP COLUMN "downloads",
DROP COLUMN "duration_s",
DROP COLUMN "ext_key",
DROP COLUMN "file_path",
DROP COLUMN "hidden",
DROP COLUMN "mux_playback_id",
DROP COLUMN "poster_path",
DROP COLUMN "poster_time",
DROP COLUMN "review_asset_id",
DROP COLUMN "review_url",
DROP COLUMN "sort",
DROP COLUMN "version_label",
DROP COLUMN "version_review_id",
DROP COLUMN "watch_url",
ALTER COLUMN "source_bible_id" SET NOT NULL,
ALTER COLUMN "source_bible_table" SET NOT NULL,
ALTER COLUMN "published_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shoot_periods" DROP COLUMN "address",
DROP COLUMN "bring",
DROP COLUMN "ext_key",
DROP COLUMN "hidden",
DROP COLUMN "location",
ALTER COLUMN "source_bible_id" SET NOT NULL,
ALTER COLUMN "source_bible_table" SET NOT NULL,
ALTER COLUMN "published_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "portal_invites" DROP COLUMN "code_hash",
DROP COLUMN "code_tries",
DROP COLUMN "device_hash",
DROP COLUMN "redirect";

-- AlterTable
ALTER TABLE "portal_sessions" DROP COLUMN "device_hash",
DROP COLUMN "device_label",
DROP COLUMN "ip_hash",
DROP COLUMN "kind",
DROP COLUMN "revoked_at",
DROP COLUMN "scope";

-- DropTable
DROP TABLE "auth_events";

-- DropTable
DROP TABLE "organizations";

-- DropTable
DROP TABLE "memberships";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "proposal_acceptances";

-- DropTable
DROP TABLE "proposal_views";

-- DropTable
DROP TABLE "project_requests";

-- DropTable
DROP TABLE "version_approvals";

-- DropTable
DROP TABLE "libraries";

-- DropTable
DROP TABLE "library_clips";

-- DropTable
DROP TABLE "library_hearts";

-- DropTable
DROP TABLE "scripts";

-- DropTable
DROP TABLE "script_updates";

-- DropTable
DROP TABLE "script_snapshots";

-- DropTable
DROP TABLE "script_clients";

-- DropTable
DROP TABLE "script_versions";

-- DropTable
DROP TABLE "script_access";

-- DropTable
DROP TABLE "script_invites";

-- DropTable
DROP TABLE "script_comments";

-- DropTable
DROP TABLE "script_approvals";

-- DropTable
DROP TABLE "script_notices";

-- DropTable
DROP TABLE "support_tickets";

-- DropTable
DROP TABLE "support_attachments";

-- DropEnum
DROP TYPE "MemberRole";

