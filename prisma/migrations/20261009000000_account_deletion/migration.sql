-- Safe account deletion lifecycle (non-breaking additive, idempotent).
-- Adds User deletion columns, AccountDeletionRequest table, new
-- NotificationType values for the deletion fan-out.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionScheduledFor" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;

DO $$ BEGIN
  CREATE TYPE "AccountDeletionStatus" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "originalEmail" TEXT NOT NULL,
  "originalUserName" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "metadata" JSONB,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_idx" ON "AccountDeletionRequest"("status");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_scheduledFor_idx" ON "AccountDeletionRequest"("scheduledFor");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_requestedAt_idx" ON "AccountDeletionRequest"("requestedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "User_isDeleted_idx" ON "User"("isDeleted");
CREATE INDEX IF NOT EXISTS "User_deletionScheduledFor_idx" ON "User"("deletionScheduledFor");

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_DELETION_REQUESTED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_DELETION_CANCELLED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_DELETION_COMPLETED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
