-- Idempotent fix for P2022 "column does not exist" errors observed in production
-- This migration ensures all columns/tables added after the initial migration exist,
-- even if prior migrations were not applied in the deployed database.
-- Safe to run multiple times due to IF NOT EXISTS guards.

-- Ensure enums exist (DO block for idempotency)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RewardTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BugCategory" AS ENUM ('UI', 'ROUTING', 'AUTH', 'PERFORMANCE', 'DATA', 'NOTIFICATIONS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- User table: add missing columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rewardPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rewardTier" "RewardTier" NOT NULL DEFAULT 'BRONZE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarConfig" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastKnownLat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastKnownLng" DOUBLE PRECISION;

-- Post table: add missing columns
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "validityScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "validityTier" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "startLat" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "startLng" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "endLat" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "endLng" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "waypoints" JSONB;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "totalDistanceKm" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "estimatedMins" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isPlatformGen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "shares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "images" TEXT[];
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "tags" TEXT[];

-- Ensure tables introduced after init exist
CREATE TABLE IF NOT EXISTS "SiteConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BugReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BugCategory" NOT NULL,
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "reporterId" TEXT,
    "reviewerId" TEXT,
    "postId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserReview" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" TEXT,
    "postId" TEXT,
    "region" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContactSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- Ensure indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteCode_key" ON "User"("inviteCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_rewardTier_idx" ON "User"("rewardTier");
CREATE INDEX IF NOT EXISTS "User_invitedById_idx" ON "User"("invitedById");

CREATE INDEX IF NOT EXISTS "Post_validityScore_idx" ON "Post"("validityScore");
CREATE INDEX IF NOT EXISTS "Post_validityTier_idx" ON "Post"("validityTier");
CREATE INDEX IF NOT EXISTS "Post_isPlatformGen_idx" ON "Post"("isPlatformGen");
CREATE INDEX IF NOT EXISTS "Post_region_idx" ON "Post"("region");
CREATE INDEX IF NOT EXISTS "Post_startLat_startLng_idx" ON "Post"("startLat", "startLng");
CREATE INDEX IF NOT EXISTS "Post_endLat_endLng_idx" ON "Post"("endLat", "endLng");

CREATE UNIQUE INDEX IF NOT EXISTS "SiteConfig_key_key" ON "SiteConfig"("key");
CREATE INDEX IF NOT EXISTS "SiteConfig_key_idx" ON "SiteConfig"("key");

CREATE INDEX IF NOT EXISTS "BugReport_reporterId_idx" ON "BugReport"("reporterId");
CREATE INDEX IF NOT EXISTS "BugReport_reviewerId_idx" ON "BugReport"("reviewerId");
CREATE INDEX IF NOT EXISTS "BugReport_status_idx" ON "BugReport"("status");
CREATE INDEX IF NOT EXISTS "BugReport_category_idx" ON "BugReport"("category");
CREATE INDEX IF NOT EXISTS "BugReport_createdAt_idx" ON "BugReport"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "UserReview_reviewerId_idx" ON "UserReview"("reviewerId");
CREATE INDEX IF NOT EXISTS "UserReview_revieweeId_idx" ON "UserReview"("revieweeId");
CREATE INDEX IF NOT EXISTS "UserReview_status_idx" ON "UserReview"("status");
CREATE INDEX IF NOT EXISTS "UserReview_createdAt_idx" ON "UserReview"("createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "UserReview_reviewerId_revieweeId_key" ON "UserReview"("reviewerId", "revieweeId");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_postId_idx" ON "AnalyticsEvent"("postId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_region_idx" ON "AnalyticsEvent"("region");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

CREATE INDEX IF NOT EXISTS "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EmailLog_to_idx" ON "EmailLog"("to");
CREATE INDEX IF NOT EXISTS "EmailLog_type_idx" ON "EmailLog"("type");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_actorId_idx" ON "Notification"("actorId");

-- Ensure foreign keys exist (idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserReview" ADD CONSTRAINT "UserReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserReview" ADD CONSTRAINT "UserReview_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Drop legacy _PostToUser join table if it still exists from very early schema
DROP TABLE IF EXISTS "_PostToUser";
