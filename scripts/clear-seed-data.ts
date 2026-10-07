/**
 * Clear SEED data only — never user-created data.
 *
 * Safety rules (hard guarantees):
 *  1. A backup JSON is ALWAYS written to backups/ before any delete runs.
 *     If the backup fails, nothing is deleted.
 *  2. Deletes are scoped strictly to the markers in scripts/lib/seedMarkers.ts
 *     (seed emails/usernames + seed post titles authored by seed users).
 *     SiteConfig seeded keys are treated as live config and are NOT touched.
 *  3. --dry-run prints what would be deleted without deleting anything.
 *
 * Usage:
 *   npm run db:clear-seed            # backup + delete
 *   npm run db:clear-seed -- --dry-run
 */

import { prisma } from "../app/lib/db/prisma";
import { collectSeedData, writeBackup } from "./lib/seedMarkers";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const backup = await collectSeedData(prisma);
  const total = Object.values(backup.counts).reduce((a, b) => a + b, 0);

  console.log("Seed data found:");
  for (const [model, count] of Object.entries(backup.counts)) {
    console.log(`  ${model.padEnd(24)} ${count}`);
  }

  if (total === 0) {
    console.log("\nNothing to clear.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no changes made.");
    return;
  }

  // 1. Backup first — refuse to delete without one.
  const file = writeBackup(backup);
  console.log(`\nBackup written: ${file}`);

  const seedUserIds = backup.data.users.map((u) => (u as { id: string }).id);
  const seedPostIds = backup.data.posts.map((p) => (p as { id: string }).id);

  const orUser = seedUserIds.length ? [{ userId: { in: seedUserIds } }] : [];
  const orPost = seedPostIds.length ? [{ postId: { in: seedPostIds } }] : [];

  // 2. Delete in dependency order (children before parents).
  const deleted: Record<string, number> = {};

  deleted.notificationRecipients = (
    await prisma.notificationRecipient.deleteMany({
      where: {
        OR: [
          ...(seedUserIds.length ? [{ userId: { in: seedUserIds } }] : []),
          ...(backup.data.notifications.length
            ? [{ notificationId: { in: backup.data.notifications.map((n) => (n as { id: string }).id) } }]
            : []),
        ],
      },
    })
  ).count;

  deleted.notifications = (
    await prisma.notification.deleteMany({
      where: {
        OR: [
          ...(seedUserIds.length ? [{ actorId: { in: seedUserIds } }] : []),
          ...(seedPostIds.length ? [{ postId: { in: seedPostIds } }] : []),
        ],
      },
    })
  ).count;

  deleted.bugReports = (
    await prisma.bugReport.deleteMany({
      where: seedUserIds.length ? { reporterId: { in: seedUserIds } } : { id: "__none__" },
    })
  ).count;

  deleted.comments = (await prisma.comment.deleteMany({ where: { OR: [...orUser, ...orPost] } })).count;
  deleted.likes = (await prisma.like.deleteMany({ where: { OR: [...orUser, ...orPost] } })).count;
  deleted.bookmarks = (await prisma.bookmark.deleteMany({ where: { OR: [...orUser, ...orPost] } })).count;
  deleted.follows = (
    await prisma.follow.deleteMany({
      where: {
        OR: [
          ...(seedUserIds.length ? [{ followerId: { in: seedUserIds } }, { followingId: { in: seedUserIds } }] : []),
        ],
      },
    })
  ).count;
  deleted.posts = (
    await prisma.post.deleteMany({
      where: { title: { in: [...backup.markers.postTitles] }, userId: { in: seedUserIds } },
    })
  ).count;
  deleted.users = (
    await prisma.user.deleteMany({
      where: { OR: [{ email: { in: [...backup.markers.emails] } }, { userName: { in: [...backup.markers.userNames] } }] },
    })
  ).count;

  console.log("\nCleared:");
  for (const [model, count] of Object.entries(deleted)) {
    console.log(`  ${model.padEnd(24)} ${count}`);
  }
  console.log(`\nRestore with: npm run db:restore-seed -- <backup file>`);
}

main()
  .catch((error) => {
    console.error("Clear failed — no partial rollback was issued; restore from the backup if needed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
