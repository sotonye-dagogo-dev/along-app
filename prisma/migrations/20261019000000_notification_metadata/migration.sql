-- AlterTable: per-notification deep-link metadata (e.g. { "bugId": ... } so a
-- REPORT assignment notification opens the exact report in the admin queue
-- instead of the generic /notifications list). Additive + nullable: legacy
-- rows keep NULL and resolve exactly as before.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
