/**
 * User-visibility registry — single source of truth for which accounts are
 * publicly visible on non-admin surfaces. Zero app deps (config layer only).
 *
 * Definitions (mirror `accountDeletionService` + Prisma `User`):
 * - deleted: `isDeleted === true` (anonymized, never interactive).
 * - archived (pending deletion): NOT deleted but `deletionScheduledFor != null`
 *   — the account sits in its 7-day reversible grace window with posts archived.
 * - visible: neither deleted nor archived.
 *
 * Non-admin user-facing instances (suggestions, carousels, search, follower
 * lists, follow actions, counts) must only ever surface visible users.
 * Admin surfaces intentionally bypass this (moderation needs the full picture).
 */

export interface UserVisibilityShape {
  isDeleted?: boolean | null;
  deletionScheduledFor?: string | Date | null;
}

/** True when the account completed deletion (anonymized). */
export function isDeletedUser(
  user: UserVisibilityShape | null | undefined,
): boolean {
  try {
    return (user as { isDeleted?: unknown } | null | undefined)?.isDeleted === true;
  } catch {
    return false;
  }
}

/** True when the account is in its reversible deletion grace window. */
export function isArchivedUser(
  user: UserVisibilityShape | null | undefined,
): boolean {
  try {
    if (!user || isDeletedUser(user)) return false;
    return (user as { deletionScheduledFor?: unknown }).deletionScheduledFor != null;
  } catch {
    return false;
  }
}

/** True when the account may appear on non-admin surfaces + accept follows. */
export function isVisibleUser(
  user: UserVisibilityShape | null | undefined,
): boolean {
  try {
    if (!user) return false;
    return !isDeletedUser(user) && !isArchivedUser(user);
  } catch {
    return false;
  }
}

/**
 * Prisma `where` fragment selecting only visible users. Spread into a user
 * query, or nest under a relation key (e.g. `user: { ...visibleUserWhere }`).
 * Never throws; safe to apply unconditionally.
 */
export const visibleUserWhere = {
  isDeleted: false,
  deletionScheduledFor: null,
} as const;

/** Copy for follow attempts against deleted/archived accounts (sanitized). */
export const DELETED_USER_COPY = {
  /** Follow POST against an unavailable account (410). */
  followUnavailable: "This account is no longer available.",
  /** Disabled follow button label/title on user-facing surfaces. */
  followUnavailableLabel: "Unavailable",
  followUnavailableTitle: "This account is no longer available",
} as const;

/**
 * Client-side defense-in-depth filter for user arrays fetched from cached or
 * legacy endpoints. Server APIs already exclude; this keeps stale caches and
 * optimistic lists consistent. Never throws, never mutates.
 */
export function filterVisibleUsers<T extends UserVisibilityShape>(
  users: readonly T[] | null | undefined,
): T[] {
  try {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => isVisibleUser(u));
  } catch {
    return [];
  }
}
