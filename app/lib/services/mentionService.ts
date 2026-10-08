/**
 * Mention extraction + resolution for @username references in comments.
 * Pure extraction (unit-testable, zero app deps) plus a thin Prisma lookup.
 * Matches the client-side renderer in `app/lib/utils/commentParser.tsx`
 * (`/@\w+/`), so anything rendered as a mention link can trigger a MENTION
 * notification — and nothing else can.
 */

import { prisma } from "@/app/lib/db/prisma";

const MENTION_PATTERN = /@(\w+)/g;
const MAX_MENTIONS_PER_COMMENT = 10;

/** Usernames referenced via @mention, lowercased + deduped. Pure function. */
export function extractMentionedUsernames(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    found.add(match[1].toLowerCase());
    if (found.size >= MAX_MENTIONS_PER_COMMENT) break;
  }
  return [...found];
}

/** Usernames present in `next` that were absent from `prev` (edit-diff). Pure. */
export function diffMentions(prev: string, next: string): string[] {
  const before = new Set(extractMentionedUsernames(prev));
  return extractMentionedUsernames(next).filter((u) => !before.has(u));
}

/**
 * Resolve usernames to user ids (case-insensitive). Never throws — returns
 * only the ids that exist. Self-mentions are NOT filtered here; the caller
 * passes actorId to createNotification which applies the self-filter.
 */
export async function resolveMentionedUserIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  try {
    const users = await prisma.user.findMany({
      where: { userName: { in: usernames, mode: "insensitive" } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch {
    return [];
  }
}
