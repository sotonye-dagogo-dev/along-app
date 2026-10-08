/**
 * ONE-TIME production database reset.
 *
 * Context: the prod DB holds really old data that predates the current seed
 * set (rows the marker-scoped `db:clear-seed` script can never match), and
 * the owner confirmed there is nothing worth keeping. This script wipes ALL
 * application rows so the next deploy starts clean.
 *
 * Status (2026-10-08): UNHOOKED from `vercel-build` after the clean build
 * was confirmed — manual-only from here on (`npm run db:reset-prod`).
 * Do NOT re-hook it into any build command: every build would wipe the DB.
 * Kept (not deleted) so an operator can still run a full reset by hand.
 *
 * Safety:
 *  - TRUNCATE … CASCADE in dependency order via a single raw statement, so
 *    no FK violations and no partial wipe.
 *  - `SiteConfig` rows are preserved (live platform config, not content).
 *  - Never fails the build: any error is logged and the process exits 0, so
 *    `vercel-build` (which calls it with `|| true`) always proceeds.
 *
 * Usage:
 *   npm run db:reset-prod
 */

import { prisma } from "../app/lib/db/prisma";

// Child tables first; SiteConfig deliberately excluded (live config).
const TABLES = [
  "NotificationRecipient",
  "Notification",
  "PushSubscription",
  "AnalyticsEvent",
  "UserActivity",
  "Like",
  "Bookmark",
  "Comment",
  "Follow",
  "BugReport",
  "UserReview",
  "ContactSubmission",
  "PasswordResetToken",
  "EmailLog",
  "Post",
  "User",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[db:reset-prod] DATABASE_URL not set — nothing to reset.");
    return;
  }
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
  console.log(`[db:reset-prod] Reset complete — truncated: ${TABLES.join(", ")} (SiteConfig preserved).`);
}

main()
  .catch((error) => {
    // One-time janitor: log loudly but never break the deploy.
    console.error("[db:reset-prod] Reset failed — continuing build anyway:", error);
  })
  .finally(() => prisma.$disconnect());
