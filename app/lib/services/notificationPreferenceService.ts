/**
 * Per-user notification preference reads. Every function is never-throw and
 * NULL-safe: a missing row, a NULL prefs JSON, or a partial JSON all resolve
 * per-key to `true` (current platform behaviour) via
 * normalizeNotificationPreferences. Callers never branch on row existence.
 */

import { prisma } from "@/app/lib/db/prisma";
import {
  normalizeNotificationPreferences,
  NOTIFICATION_TYPE_TO_PREFERENCE_KEY,
  type NotificationPreferenceMap,
} from "@/app/lib/config/notificationPreferences";

/** Effective prefs for one user (defaults on any failure/shape). */
export async function getEffectivePreferences(
  userId: string
): Promise<NotificationPreferenceMap> {
  try {
    if (!userId) return normalizeNotificationPreferences(null);
    const row = await prisma.notificationPreference.findUnique({
      where: { userId },
      select: { prefs: true },
    });
    return normalizeNotificationPreferences(
      (row as { prefs?: unknown } | null)?.prefs ?? null
    );
  } catch {
    return normalizeNotificationPreferences(null);
  }
}

/** Effective prefs for many users in one query (missing ids = defaults). */
export async function getEffectivePreferencesMany(
  userIds: string[]
): Promise<Map<string, NotificationPreferenceMap>> {
  const out = new Map<string, NotificationPreferenceMap>();
  const ids = [...new Set((userIds ?? []).filter(Boolean))];
  for (const id of ids) out.set(id, normalizeNotificationPreferences(null));
  if (ids.length === 0) return out;
  try {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, prefs: true },
    });
    for (const row of rows as { userId: string; prefs?: unknown }[]) {
      if (row?.userId) out.set(row.userId, normalizeNotificationPreferences(row.prefs ?? null));
    }
  } catch {
    /* defaults stand */
  }
  return out;
}

/**
 * Filters a recipient list to users whose effective prefs allow `type`.
 * Unknown types default to allowed (fail-open = current behaviour).
 * Never throws; on any error the input list passes through unfiltered.
 */
export async function filterRecipientsByPreferences(
  recipientIds: string[],
  type: string
): Promise<string[]> {
  try {
    const ids = [...new Set((recipientIds ?? []).filter(Boolean))];
    if (ids.length === 0) return ids;
    const key = NOTIFICATION_TYPE_TO_PREFERENCE_KEY[String(type ?? "")];
    if (!key) return ids;
    const prefsByUser = await getEffectivePreferencesMany(ids);
    return ids.filter((id) => prefsByUser.get(id)?.[key] !== false);
  } catch {
    return [...new Set((recipientIds ?? []).filter(Boolean))];
  }
}
