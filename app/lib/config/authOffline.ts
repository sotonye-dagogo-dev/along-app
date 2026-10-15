/**
 * Auth offline-session registry — single source of truth for preserving the
 * signed-in identity across offline reloads (airplane mode, flaky networks).
 *
 * Problem: AuthProvider boots with `user: null` and learns the session from
 * `/api/auth/me`. On an offline reload that fetch fails, so `isGuest` flips
 * true and the GuestBanner ("Browse as a guest…") appears even though the
 * user never signed out — purely a connectivity artefact.
 *
 * Fix (display-only, non-authoritative): persist a lightweight snapshot of
 * the last *server-confirmed* session in localStorage. On boot the provider
 * hydrates from it synchronously, so an offline reload keeps showing the
 * signed-in UI (no guest banner, no login redirect). The snapshot is:
 * - cleared on genuine 401 (refresh rejected) and on explicit logout,
 * - TTL-bounded (stale snapshots are ignored),
 * - never used for authorization — every API still validates the httpOnly
 *   auth cookie server-side; the snapshot only drives UI identity.
 *
 * Zero app deps (config layer only) so AuthProvider, GuestBanner, and tests
 * can all share it without import cycles.
 */

export interface AuthSnapshotUser {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null;
  role: string;
}

interface AuthSnapshotEnvelope {
  user: AuthSnapshotUser;
  savedAt: number;
}

export const AUTH_OFFLINE_CONFIG = {
  storageKey: "along-auth-snapshot",
  /** Snapshots older than this are ignored (stale device, likely signed out elsewhere). */
  ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days — mirrors the server refresh-token window
} as const;

function isSnapshotUser(value: unknown): value is AuthSnapshotUser {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id.length > 0 && typeof v.userName === "string";
}

/** Read the last server-confirmed session snapshot (null when absent/stale). */
export function readAuthSnapshot(now: number = Date.now()): AuthSnapshotUser | null {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return null;
    const raw = window.localStorage.getItem(AUTH_OFFLINE_CONFIG.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSnapshotEnvelope>;
    if (!parsed || !isSnapshotUser(parsed.user)) return null;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > AUTH_OFFLINE_CONFIG.ttlMs) {
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

/** Persist a server-confirmed session (call only after /api/auth/me 200). */
export function writeAuthSnapshot(user: AuthSnapshotUser): void {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    const envelope: AuthSnapshotEnvelope = { user, savedAt: Date.now() };
    window.localStorage.setItem(AUTH_OFFLINE_CONFIG.storageKey, JSON.stringify(envelope));
  } catch {
    // private-mode / quota — non-critical, session simply won't survive reloads
  }
}

/** Drop the snapshot (genuine 401, explicit logout). Never throws. */
export function clearAuthSnapshot(): void {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    window.localStorage.removeItem(AUTH_OFFLINE_CONFIG.storageKey);
  } catch {
    // ignore
  }
}
