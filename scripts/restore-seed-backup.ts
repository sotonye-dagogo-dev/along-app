/**
 * Restore a backup written by scripts/backup-seed-data.ts or
 * scripts/clear-seed-data.ts.
 *
 * Re-inserts rows best-effort: existing rows (matched by natural keys) are
 * skipped so the restore is safe to run against a partially-restored DB.
 *
 * Usage: npm run db:restore-seed -- backups/seed-backup-2026-10-07T....json
 */

import { prisma } from "../app/lib/db/prisma";
import { readBackup } from "./lib/seedMarkers";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run db:restore-seed -- <backup file>");
    process.exit(1);
  }
  const backup = readBackup(file);
  console.log(`Restoring seed backup from ${backup.createdAt} (${file})`);

  const restored: Record<string, number> = {};

  // Users (natural key: email)
  restored.users = 0;
  for (const user of backup.data.users as any[]) {
    const { id, ...data } = user;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (!existing) {
      await prisma.user.create({ data: { ...data, id } });
      restored.users++;
    }
  }

  // Posts (natural key: id; skip if the id exists)
  restored.posts = 0;
  for (const post of backup.data.posts as any[]) {
    const existing = await prisma.post.findUnique({ where: { id: post.id } });
    if (!existing) {
      await prisma.post.create({ data: post });
      restored.posts++;
    }
  }

  const restoreUnique = async (rows: any[], key: "postId_userId" | "followerId_followingId", name: string) => {
    restored[name] = 0;
    for (const row of rows) {
      try {
        await (prisma as any)[name].create({ data: row });
        restored[name]++;
      } catch {
        // unique violation or missing FK — skip
      }
    }
  };

  await restoreUnique(backup.data.comments as any[], "postId_userId", "comments");
  await restoreUnique(backup.data.likes as any[], "postId_userId", "likes");
  await restoreUnique(backup.data.bookmarks as any[], "postId_userId", "bookmarks");
  await restoreUnique(backup.data.follows as any[], "followerId_followingId", "follows");

  // Notifications (id key) + recipients
  restored.notifications = 0;
  for (const n of backup.data.notifications as any[]) {
    try {
      const existing = await prisma.notification.findUnique({ where: { id: n.id } });
      if (!existing) {
        await prisma.notification.create({ data: n });
        restored.notifications++;
      }
    } catch {
      // FK target gone — skip
    }
  }
  restored.notificationRecipients = 0;
  for (const r of backup.data.notificationRecipients as any[]) {
    try {
      await prisma.notificationRecipient.create({ data: r });
      restored.notificationRecipients++;
    } catch {
      // duplicate/FK — skip
    }
  }

  console.log("\nRestored (rows actually inserted):");
  for (const [model, count] of Object.entries(restored)) {
    console.log(`  ${model.padEnd(24)} ${count}`);
  }
}

main()
  .catch((error) => {
    console.error("Restore failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
