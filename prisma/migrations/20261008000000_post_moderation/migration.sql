-- Post moderation + report lifecycle (non-breaking additive).
-- Idempotent: safe to run multiple times (IF NOT EXISTS / DO guards).

-- Archive columns on Post (hidden from feeds, restorable by owner/admin).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "Post_isArchived_idx" ON "Post"("isArchived");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- NotificationType additions for the report lifecycle.
-- Postgres < 11 cannot ADD VALUE inside a transaction block with other DDL,
-- so each addition is isolated; IF NOT EXISTS is not supported for enum
-- values, hence the duplicate_object guard.
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'REPORT';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'MODERATION';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
