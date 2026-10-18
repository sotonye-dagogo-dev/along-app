/**
 * Safe client refresh configuration (config-driven, zero app deps).
 *
 * Single source of truth for the "maintenance over — kindly refresh" flow:
 * which web-storage keys survive a forced refresh (drafts, session
 * snapshot, preferences) and which copy the trigger button uses. The
 * browser-side routine lives in `app/lib/pwa/safeClientRefresh.ts`.
 *
 * Contract — the refresh MUST keep:
 * - auth cookies (never touched — httpOnly, different origin store),
 * - the offline auth snapshot (`along-auth-snapshot`) + saved drafts,
 * - user preferences (theme, locale, push/PWA flags, sidebar state).
 * And MUST clear: Cache Storage caches, non-protected web storage, and
 * every service worker registration (then reload cache-busted), so the
 * client re-fetches fresh code + data without a PWA reinstall.
 */
export interface SafeRefreshConfig {
  /** Exact localStorage keys preserved through the clear. */
  preserveLocalStorageKeys: readonly string[];
  /** localStorage key prefixes preserved (matched with startsWith). */
  preserveLocalStoragePrefixes: readonly string[];
  /** sessionStorage: every key is transient notice state — all cleared. */
  clearSessionStorage: boolean;
  /** Query param name used to cache-bust the reload navigation. */
  cacheBustParam: string;
  /** Best-effort guard so a double-click can't stack reloads. */
  inFlightKey: string;
}

export const SAFE_REFRESH_CONFIG: SafeRefreshConfig = {
  preserveLocalStorageKeys: [
    // Drafts (share-route composer) — user work, never discardable.
    "along_route_drafts",
    "along_route_draft",
    "along_route_draft_resp",
    // Offline auth snapshot — keeps signed-in state across the refresh.
    "along-auth-snapshot",
    // Preferences.
    "along-locale",
    "along-theme",
    "along-push-enabled",
    "along-push-dismissed-at",
    "along-pwa-installed",
    "along-pwa-dismissed-at",
    "along-sw-update-dismissed-at",
    "along-sw-update-reloaded",
    "along-offline-banner-collapsed",
    "along:admin-sidebar-collapsed",
  ],
  preserveLocalStoragePrefixes: [
    // Locale dictionary cache — tiny, revalidates fast; keeping it avoids
    // an offline-flash of raw keys right after the refresh.
    "along-locale-cache",
  ],
  clearSessionStorage: true,
  cacheBustParam: "_fresh",
  inFlightKey: "along-safe-refresh-inflight",
} as const;
