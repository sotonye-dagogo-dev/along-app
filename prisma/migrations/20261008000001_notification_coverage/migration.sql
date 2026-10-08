-- Notification coverage: DISLIKE + NEW_ROUTE (non-breaking additive).
-- Idempotent: safe to run multiple times (duplicate_object guards).
-- DISLIKE notifies a post author when their post is disliked.
-- NEW_ROUTE fans out to followers when someone they follow shares a route.

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'DISLIKE';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'NEW_ROUTE';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
