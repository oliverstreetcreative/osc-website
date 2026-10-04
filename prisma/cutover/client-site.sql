-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'APPROVER', 'BILLING', 'VIEWER');

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "calendar_token" TEXT,
ALTER COLUMN "source_bible_id" DROP NOT NULL,
ALTER COLUMN "source_bible_table" DROP NOT NULL,
ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "dates" JSONB,
ADD COLUMN     "ext_key" TEXT,
ADD COLUMN     "from_request" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "money" JSONB,
ADD COLUMN     "next_step" TEXT,
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "poster_mux_id" TEXT,
ADD COLUMN     "poster_path" TEXT,
ADD COLUMN     "poster_time" DOUBLE PRECISION,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "sort_date" TIMESTAMP(3),
ADD COLUMN     "status_line" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "team" JSONB,
ALTER COLUMN "source_bible_id" DROP NOT NULL,
ALTER COLUMN "source_bible_table" DROP NOT NULL,
ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "deliverables" ADD COLUMN     "approval" TEXT NOT NULL DEFAULT 'any',
ADD COLUMN     "approvers" JSONB,
ADD COLUMN     "ask" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "aspect" TEXT,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "downloads" JSONB,
ADD COLUMN     "duration_s" INTEGER,
ADD COLUMN     "ext_key" TEXT,
ADD COLUMN     "file_path" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mux_playback_id" TEXT,
ADD COLUMN     "poster_path" TEXT,
ADD COLUMN     "poster_time" DOUBLE PRECISION,
ADD COLUMN     "review_asset_id" TEXT,
ADD COLUMN     "review_url" TEXT,
ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version_label" TEXT,
ADD COLUMN     "version_review_id" TEXT,
ADD COLUMN     "watch_url" TEXT,
ALTER COLUMN "source_bible_id" DROP NOT NULL,
ALTER COLUMN "source_bible_table" DROP NOT NULL,
ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "shoot_periods" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bring" TEXT,
ADD COLUMN     "ext_key" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ALTER COLUMN "source_bible_id" DROP NOT NULL,
ALTER COLUMN "source_bible_table" DROP NOT NULL,
ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "logo_path" TEXT,
    "website" TEXT,
    "billing_email" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'VIEWER',
    "title" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "issued_on" DATE NOT NULL,
    "due_on" DATE,
    "paid_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "pay_url" TEXT,
    "pdf_path" TEXT,
    "memo" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "ext_key" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dated_on" DATE,
    "dropbox_path" TEXT,
    "url" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "signed_by" TEXT,
    "signed_on" DATE,
    "signatures" JSONB,
    "sha256" TEXT,
    "ask" TEXT NOT NULL DEFAULT 'none',
    "acceptors" JSONB,
    "good_until" DATE,
    "total" DECIMAL(10,2),
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_acceptances" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "job" TEXT,
    "doc_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "total" DECIMAL(10,2),
    "good_until" DATE,
    "person_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "org_slug" TEXT NOT NULL,
    "member_role" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledger_path" TEXT,
    "ledger_written_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "proposal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_views" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "sha256" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "person_name" TEXT NOT NULL,
    "person_email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "like_project" TEXT,
    "timing" TEXT NOT NULL,
    "due_on" DATE,
    "about" TEXT,
    "form_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queue_file" TEXT,
    "queued_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_approvals" (
    "id" UUID NOT NULL,
    "deliverable_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "job" TEXT,
    "film_key" TEXT NOT NULL,
    "film_title" TEXT NOT NULL,
    "review_asset_id" TEXT NOT NULL,
    "review_version_id" TEXT NOT NULL,
    "review_version_n" INTEGER NOT NULL,
    "review_posted_at" TIMESTAMP(3),
    "version_label" TEXT,
    "filename" TEXT,
    "checksum" TEXT,
    "person_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "member_role" TEXT NOT NULL,
    "note" TEXT,
    "how" TEXT NOT NULL DEFAULT 'portal',
    "ip" TEXT,
    "user_agent" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledger_path" TEXT,
    "ledger_written_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "version_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libraries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "ext_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "job" TEXT,
    "clip_count" INTEGER NOT NULL DEFAULT 0,
    "first_day" DATE,
    "last_day" DATE,
    "source_rev" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_clips" (
    "id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "ext_key" TEXT NOT NULL,
    "clip_key" TEXT NOT NULL,
    "sam_event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taken_on" DATE,
    "fps" DOUBLE PRECISION NOT NULL,
    "mux_playback_id" TEXT NOT NULL,
    "duration_s" DOUBLE PRECISION NOT NULL,
    "thumb_s" DOUBLE PRECISION,
    "aspect" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "library_clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_hearts" (
    "id" UUID NOT NULL,
    "clip_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "favorite" BOOLEAN NOT NULL,
    "seq" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledger_written_at" TIMESTAMP(3),

    CONSTRAINT "library_hearts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "project_id" UUID,
    "deliverable_id" UUID,
    "job" TEXT,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'av',
    "target_seconds" INTEGER,
    "pace_wpm" INTEGER NOT NULL DEFAULT 150,
    "reader" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'office',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "canonical" TEXT NOT NULL DEFAULT 'dropbox',
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "shoot_version" INTEGER,
    "approvers" JSONB,
    "approval" TEXT NOT NULL DEFAULT 'any',
    "source" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_updates" (
    "id" BIGSERIAL NOT NULL,
    "script_id" UUID NOT NULL,
    "update" BYTEA NOT NULL,
    "person_id" UUID NOT NULL,
    "client_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_snapshots" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "upto_id" BIGINT NOT NULL,
    "state" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_clients" (
    "script_id" UUID NOT NULL,
    "client_id" BIGINT NOT NULL,
    "person_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_clients_pkey" PRIMARY KEY ("script_id","client_id")
);

-- CreateTable
CREATE TABLE "script_versions" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "n" INTEGER NOT NULL,
    "name" TEXT,
    "kind" TEXT NOT NULL,
    "upto_id" BIGINT NOT NULL,
    "state" BYTEA NOT NULL,
    "text" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "total_seconds" DOUBLE PRECISION,
    "authors" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_access" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "person_id" UUID,
    "organization_id" UUID,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "script_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_invites" (
    "id" UUID NOT NULL,
    "access_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "spent_at" TIMESTAMP(3),

    CONSTRAINT "script_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_comments" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "parent_id" UUID,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "anchor" JSONB,
    "quote" TEXT,
    "suggestion" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'office',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_approvals" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "version_n" INTEGER NOT NULL,
    "text_sha256" TEXT NOT NULL,
    "person_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_notices" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "script_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "env" TEXT NOT NULL,
    "person_id" UUID,
    "organization_id" UUID,
    "role" TEXT,
    "reporter_email" TEXT,
    "surface" TEXT NOT NULL DEFAULT 'portal',
    "route" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "has_screenshot" BOOLEAN NOT NULL DEFAULT false,
    "ip_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "status_at" TIMESTAMP(3),
    "client_note" TEXT,
    "mirrored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_person_id_idx" ON "memberships"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_person_id_key" ON "memberships"("organization_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_ext_key_key" ON "documents"("ext_key");

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_acceptances_document_id_key" ON "proposal_acceptances"("document_id");

-- CreateIndex
CREATE INDEX "proposal_acceptances_organization_id_idx" ON "proposal_acceptances"("organization_id");

-- CreateIndex
CREATE INDEX "proposal_views_document_id_at_idx" ON "proposal_views"("document_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "project_requests_form_key_key" ON "project_requests"("form_key");

-- CreateIndex
CREATE INDEX "project_requests_organization_id_idx" ON "project_requests"("organization_id");

-- CreateIndex
CREATE INDEX "project_requests_status_idx" ON "project_requests"("status");

-- CreateIndex
CREATE INDEX "version_approvals_organization_id_idx" ON "version_approvals"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "version_approvals_deliverable_id_review_version_id_person_i_key" ON "version_approvals"("deliverable_id", "review_version_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "libraries_ext_key_key" ON "libraries"("ext_key");

-- CreateIndex
CREATE INDEX "libraries_organization_id_idx" ON "libraries"("organization_id");

-- CreateIndex
CREATE INDEX "libraries_project_id_idx" ON "libraries"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_clips_ext_key_key" ON "library_clips"("ext_key");

-- CreateIndex
CREATE INDEX "library_clips_library_id_hidden_sort_idx" ON "library_clips"("library_id", "hidden", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "library_hearts_seq_key" ON "library_hearts"("seq");

-- CreateIndex
CREATE INDEX "library_hearts_person_id_clip_id_at_idx" ON "library_hearts"("person_id", "clip_id", "at");

-- CreateIndex
CREATE INDEX "library_hearts_ledger_written_at_idx" ON "library_hearts"("ledger_written_at");

-- CreateIndex
CREATE INDEX "scripts_organization_id_idx" ON "scripts"("organization_id");

-- CreateIndex
CREATE INDEX "scripts_project_id_idx" ON "scripts"("project_id");

-- CreateIndex
CREATE INDEX "script_updates_script_id_id_idx" ON "script_updates"("script_id", "id");

-- CreateIndex
CREATE INDEX "script_snapshots_script_id_upto_id_idx" ON "script_snapshots"("script_id", "upto_id");

-- CreateIndex
CREATE INDEX "script_clients_person_id_idx" ON "script_clients"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "script_versions_script_id_n_key" ON "script_versions"("script_id", "n");

-- CreateIndex
CREATE INDEX "script_access_script_id_idx" ON "script_access"("script_id");

-- CreateIndex
CREATE INDEX "script_access_person_id_idx" ON "script_access"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "script_invites_token_hash_key" ON "script_invites"("token_hash");

-- CreateIndex
CREATE INDEX "script_invites_access_id_idx" ON "script_invites"("access_id");

-- CreateIndex
CREATE INDEX "script_comments_script_id_thread_id_idx" ON "script_comments"("script_id", "thread_id");

-- CreateIndex
CREATE INDEX "script_approvals_script_id_idx" ON "script_approvals"("script_id");

-- CreateIndex
CREATE INDEX "script_notices_person_id_sent_at_idx" ON "script_notices"("person_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- CreateIndex
CREATE INDEX "support_tickets_person_id_created_at_idx" ON "support_tickets"("person_id", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_ip_hash_created_at_idx" ON "support_tickets"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "support_attachments_ticket_id_idx" ON "support_attachments"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_calendar_token_key" ON "people"("calendar_token");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ext_key_key" ON "projects"("ext_key");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_ext_key_key" ON "deliverables"("ext_key");

-- CreateIndex
CREATE UNIQUE INDEX "shoot_periods_ext_key_key" ON "shoot_periods"("ext_key");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_approvals" ADD CONSTRAINT "version_approvals_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_clips" ADD CONSTRAINT "library_clips_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_hearts" ADD CONSTRAINT "library_hearts_clip_id_fkey" FOREIGN KEY ("clip_id") REFERENCES "library_clips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_updates" ADD CONSTRAINT "script_updates_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_snapshots" ADD CONSTRAINT "script_snapshots_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_clients" ADD CONSTRAINT "script_clients_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_clients" ADD CONSTRAINT "script_clients_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_access" ADD CONSTRAINT "script_access_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_access" ADD CONSTRAINT "script_access_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_access" ADD CONSTRAINT "script_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_invites" ADD CONSTRAINT "script_invites_access_id_fkey" FOREIGN KEY ("access_id") REFERENCES "script_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_comments" ADD CONSTRAINT "script_comments_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_approvals" ADD CONSTRAINT "script_approvals_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_notices" ADD CONSTRAINT "script_notices_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_notices" ADD CONSTRAINT "script_notices_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
