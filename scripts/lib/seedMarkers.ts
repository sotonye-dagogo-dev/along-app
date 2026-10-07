/**
 * Seed data markers + backup/collect helpers.
 *
 * Shared by scripts/backup-seed-data.ts, scripts/clear-seed-data.ts and
 * scripts/restore-seed-backup.ts so that everything that touches seed data
 * agrees on exactly what "seed data" means. Real user-created data must
 * never be matched by these markers.
 */

import type { PrismaClient } from "../../app/generated/prisma/client";
import * as fs from "fs";
import * as path from "path";

/** The 10 dev accounts created by prisma/seed.ts — all on *.example.com. */
export const SEED_EMAILS = [
  "chidi@example.com",
  "ada@example.com",
  "emeka@example.com",
  "ngozi@example.com",
  "tunde@example.com",
  "zainab@example.com",
  "bola@example.com",
  "ifeanyi@example.com",
  "amina@example.com",
  "john.doe@example.com",
] as const;

export const SEED_USERNAMES = [
  "chidi_travels",
  "ada_explorer",
  "emeka_routes",
  "ngozi_wanderer",
  "tunde_navigator",
  "zainab_traveler",
  "bola_roadtrip",
  "ifeanyi_budget",
  "amina_explorer",
  "john_doe",
] as const;

/** Titles of the 10 posts created by prisma/seed.ts. */
export const SEED_POST_TITLES = [
  "Best Route from Ikeja to Victoria Island - Beat the Traffic!",
  "Weekend Trip: Lagos to Ibadan via Public Transport",
  "Navigating Abuja: Kubwa to Wuse Market Route",
  "Lagos to Abuja: The Ultimate Road Trip Guide",
  "Enugu: Coal City Historical Walking Tour",
  "Calabar Carnival Route: Best Viewing Spots",
  "Budget Trip: Owerri to Port Harcourt",
  "Exploring Kano: From Dala Hill to Kurmi Market",
  "Kaduna to Jos: Mountain Adventure",
  "First Timer's Guide: Lekki Phase 1 to Ajah",
] as const;

export interface SeedBackup {
  version: 1;
  createdAt: string;
  markers: {
    emails: readonly string[];
    userNames: readonly string[];
    postTitles: readonly string[];
  };
  counts: Record<string, number>;
  data: {
    users: unknown[];
    posts: unknown[];
    comments: unknown[];
    likes: unknown[];
    bookmarks: unknown[];
    follows: unknown[];
    notifications: unknown[];
    notificationRecipients: unknown[];
    bugReports: unknown[];
  };
}

/**
 * Collects every row that the clear script would delete — including rows
 * created by REAL users that are only attached to seed rows (e.g. a real
 * user's comment on a seed post), so nothing is silently lost.
 */
export async function collectSeedData(prisma: PrismaClient): Promise<SeedBackup> {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: [...SEED_EMAILS] } }, { userName: { in: [...SEED_USERNAMES] } }] },
  });
  const seedUserIds = users.map((u) => u.id);

  // Both title AND seed author must match — never claim a real user's post.
  const posts = await prisma.post.findMany({
    where: { title: { in: [...SEED_POST_TITLES] }, userId: { in: seedUserIds } },
  });
  const seedPostIds = posts.map((p) => p.id);

  const orUser = seedUserIds.length ? [{ userId: { in: seedUserIds } }] : [];
  const orPost = seedPostIds.length ? [{ postId: { in: seedPostIds } }] : [];

  const comments = await prisma.comment.findMany({
    where: { OR: [...orUser, ...orPost] },
    include: { user: { select: { userName: true, email: true } } },
  });
  const likes = await prisma.like.findMany({ where: { OR: [...orUser, ...orPost] } });
  const bookmarks = await prisma.bookmark.findMany({ where: { OR: [...orUser, ...orPost] } });
  const follows = await prisma.follow.findMany({
    where: {
      OR: [
        ...(seedUserIds.length ? [{ followerId: { in: seedUserIds } }, { followingId: { in: seedUserIds } }] : []),
      ],
    },
  });
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        ...(seedUserIds.length ? [{ actorId: { in: seedUserIds } }] : []),
        ...(seedPostIds.length ? [{ postId: { in: seedPostIds } }] : []),
        ...(seedUserIds.length ? [{ recipients: { some: { userId: { in: seedUserIds } } } }] : []),
      ],
    },
  });
  const notificationRecipients = await prisma.notificationRecipient.findMany({
    where: {
      OR: [
        ...(seedUserIds.length ? [{ userId: { in: seedUserIds } }] : []),
        ...(notifications.length ? [{ notificationId: { in: notifications.map((n) => n.id) } }] : []),
      ],
    },
  });
  const bugReports = await prisma.bugReport.findMany({
    where: seedUserIds.length ? { reporterId: { in: seedUserIds } } : { id: "__none__" },
  });

  const data = { users, posts, comments, likes, bookmarks, follows, notifications, notificationRecipients, bugReports };
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    markers: { emails: SEED_EMAILS, userNames: SEED_USERNAMES, postTitles: SEED_POST_TITLES },
    counts,
    data,
  };
}

export function backupDir(): string {
  return path.join(process.cwd(), "backups");
}

/** Writes the backup JSON and returns the file path. Throws on failure. */
export function writeBackup(backup: SeedBackup): string {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = backup.createdAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `seed-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");
  return file;
}

export function readBackup(file: string): SeedBackup {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as SeedBackup;
  if (parsed.version !== 1 || !parsed.data) {
    throw new Error(`Unrecognized backup file: ${file}`);
  }
  return parsed;
}
