-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'CREW', 'STAFF');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'APPROVER', 'BILLING', 'VIEWER');

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "portal_allowed" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL,
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publication_version" INTEGER NOT NULL DEFAULT 1,
    "calendar_token" TEXT,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "phase" TEXT NOT NULL DEFAULT 'Proposal',
    "job_number" TEXT,
    "client_portal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "crew_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publication_version" INTEGER NOT NULL DEFAULT 1,
    "ext_key" TEXT,
    "organization_id" UUID,
    "slug" TEXT,
    "kind" TEXT,
    "summary" TEXT,
    "status_line" TEXT,
    "next_step" TEXT,
    "poster_path" TEXT,
    "poster_mux_id" TEXT,
    "poster_time" DOUBLE PRECISION,
    "dates" JSONB,
    "team" JSONB,
    "sort_date" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "from_request" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'client',
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_participants" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "crew_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deliverable_type" TEXT NOT NULL DEFAULT 'video',
    "description" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "review_status" TEXT NOT NULL DEFAULT 'Not Ready',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "dropbox_replay_url" TEXT,
    "shared_at" TIMESTAMP(3),
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publication_version" INTEGER NOT NULL DEFAULT 1,
    "ext_key" TEXT,
    "mux_playback_id" TEXT,
    "file_path" TEXT,
    "aspect" TEXT,
    "poster_path" TEXT,
    "poster_time" DOUBLE PRECISION,
    "duration_s" INTEGER,
    "version_label" TEXT,
    "watch_url" TEXT,
    "review_url" TEXT,
    "review_asset_id" TEXT,
    "version_review_id" TEXT,
    "approvers" JSONB,
    "approval" TEXT NOT NULL DEFAULT 'any',
    "ask" TEXT NOT NULL DEFAULT 'none',
    "downloads" JSONB,
    "delivered_at" TIMESTAMP(3),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_reviews" (
    "id" UUID NOT NULL,
    "deliverable_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Pending Review',
    "notes" TEXT NOT NULL DEFAULT '',
    "timecode_seconds" INTEGER,
    "decision" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "deliverable_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_approvals" (
    "id" UUID NOT NULL,
    "deliverable_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMP(3) NOT NULL,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "deliverable_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_updates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT '',
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "client_reply" TEXT,
    "client_replied_at" TIMESTAMP(3),
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "cost_impact" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Proposed',
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "proposed_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'receivable',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "obligation_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoot_periods" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "period_type" TEXT,
    "call_time" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "crew_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publication_version" INTEGER NOT NULL DEFAULT 1,
    "ext_key" TEXT,
    "location" TEXT,
    "address" TEXT,
    "bring" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shoot_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "project_id" UUID,
    "purpose" TEXT,
    "departure_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "crew_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "assignee_person_id" UUID,
    "phase" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "crew_visible" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "blocked_by" JSONB,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_uploads" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "mime_type" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "portal_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_events" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "person_id" UUID,
    "event_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "published_at" TIMESTAMP(3),
    "publication_version" INTEGER DEFAULT 1,

    CONSTRAINT "portal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_invites" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "magic_link_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_error_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "project_id" UUID,
    "source_table" TEXT,
    "source_bible_id" INTEGER,
    "source_bible_table" TEXT,
    "portal_url" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'moderate',
    "status" TEXT NOT NULL DEFAULT 'open',
    "triaged_at" TIMESTAMP(3),
    "triaged_by_agent" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "paperclip_issue_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_error_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "rating" INTEGER,
    "body" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "source_bible_id" INTEGER NOT NULL,
    "source_bible_table" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "publication_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

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
    "sha256" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "people_email_key" ON "people"("email");

-- CreateIndex
CREATE UNIQUE INDEX "people_calendar_token_key" ON "people"("calendar_token");

-- CreateIndex
CREATE INDEX "idx_people_source_bible" ON "people"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ext_key_key" ON "projects"("ext_key");

-- CreateIndex
CREATE INDEX "idx_projects_source_bible" ON "projects"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "project_contacts_project_id_idx" ON "project_contacts"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_contacts_source_bible" ON "project_contacts"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE UNIQUE INDEX "project_contacts_person_id_project_id_key" ON "project_contacts"("person_id", "project_id");

-- CreateIndex
CREATE INDEX "project_participants_project_id_idx" ON "project_participants"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_participants_source_bible" ON "project_participants"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE UNIQUE INDEX "project_participants_person_id_project_id_key" ON "project_participants"("person_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_ext_key_key" ON "deliverables"("ext_key");

-- CreateIndex
CREATE INDEX "deliverables_project_id_idx" ON "deliverables"("project_id");

-- CreateIndex
CREATE INDEX "idx_deliverables_source_bible" ON "deliverables"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "deliverable_reviews_deliverable_id_idx" ON "deliverable_reviews"("deliverable_id");

-- CreateIndex
CREATE INDEX "idx_deliverable_reviews_source_bible" ON "deliverable_reviews"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "deliverable_approvals_deliverable_id_idx" ON "deliverable_approvals"("deliverable_id");

-- CreateIndex
CREATE INDEX "idx_deliverable_approvals_source_bible" ON "deliverable_approvals"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "project_updates_project_id_idx" ON "project_updates"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_updates_source_bible" ON "project_updates"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "change_orders_project_id_idx" ON "change_orders"("project_id");

-- CreateIndex
CREATE INDEX "idx_change_orders_source_bible" ON "change_orders"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "obligations_project_id_idx" ON "obligations"("project_id");

-- CreateIndex
CREATE INDEX "idx_obligations_source_bible" ON "obligations"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE UNIQUE INDEX "shoot_periods_ext_key_key" ON "shoot_periods"("ext_key");

-- CreateIndex
CREATE INDEX "shoot_periods_project_id_idx" ON "shoot_periods"("project_id");

-- CreateIndex
CREATE INDEX "idx_shoot_periods_source_bible" ON "shoot_periods"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "trips_project_id_idx" ON "trips"("project_id");

-- CreateIndex
CREATE INDEX "idx_trips_source_bible" ON "trips"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "idx_tasks_source_bible" ON "tasks"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "portal_uploads_project_id_idx" ON "portal_uploads"("project_id");

-- CreateIndex
CREATE INDEX "idx_portal_uploads_source_bible" ON "portal_uploads"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE INDEX "portal_events_project_id_idx" ON "portal_events"("project_id");

-- CreateIndex
CREATE INDEX "idx_portal_events_processed_at" ON "portal_events"("processed_at");

-- CreateIndex
CREATE INDEX "idx_portal_events_source_bible" ON "portal_events"("source_bible_id", "source_bible_table");

-- CreateIndex
CREATE UNIQUE INDEX "portal_invites_magic_link_hash_key" ON "portal_invites"("magic_link_hash");

-- CreateIndex
CREATE UNIQUE INDEX "portal_sessions_token_hash_key" ON "portal_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "portal_error_reports_reporter_id_idx" ON "portal_error_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "portal_error_reports_project_id_idx" ON "portal_error_reports"("project_id");

-- CreateIndex
CREATE INDEX "portal_error_reports_status_idx" ON "portal_error_reports"("status");

-- CreateIndex
CREATE INDEX "testimonials_project_id_idx" ON "testimonials"("project_id");

-- CreateIndex
CREATE INDEX "idx_testimonials_source_bible" ON "testimonials"("source_bible_id", "source_bible_table");

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

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_reviews" ADD CONSTRAINT "deliverable_reviews_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_reviews" ADD CONSTRAINT "deliverable_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_approvals" ADD CONSTRAINT "deliverable_approvals_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_approvals" ADD CONSTRAINT "deliverable_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoot_periods" ADD CONSTRAINT "shoot_periods_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_person_id_fkey" FOREIGN KEY ("assignee_person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_uploads" ADD CONSTRAINT "portal_uploads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_uploads" ADD CONSTRAINT "portal_uploads_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_events" ADD CONSTRAINT "portal_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_events" ADD CONSTRAINT "portal_events_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_error_reports" ADD CONSTRAINT "portal_error_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_error_reports" ADD CONSTRAINT "portal_error_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
