-- Gate-only email links (Sam 10/11 23:20); additive, no Person/session privilege.
CREATE TABLE IF NOT EXISTS "staging_access_links" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "next_path" TEXT NOT NULL,
  "device_hash" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "code_tries" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staging_access_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "staging_access_links_token_hash_key" ON "staging_access_links"("token_hash");
CREATE INDEX IF NOT EXISTS "staging_access_links_email_origin_created_at_idx" ON "staging_access_links"("email", "origin", "created_at");
CREATE INDEX IF NOT EXISTS "staging_access_links_expires_at_idx" ON "staging_access_links"("expires_at");
