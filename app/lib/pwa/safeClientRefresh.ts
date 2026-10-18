"use client";

/**
 * Safe client refresh — clears stale caches + reboots the service worker
 * WITHOUT dropping the user's session, drafts, or preferences, and without
 * requiring a PWA reinstall.
 *
 * Sequence (every step try/catch fail-open; a failure never blocks the
 * reload — worst case the next load just re-fetches something extra):
 * 1. Record the refresh-completed once-flag (preserve-whitelisted) so the
 *    admin "kindly refresh" strip stops nagging within its TTL.
 * 2. Clear non-protected localStorage (drafts/session/prefs survive).
 * 3. Clear sessionStorage (transient notice-dismiss state only).
 * 4. Delete every Cache Storage cache (SW-held API/page/image caches).
 * 5. Unregister every service worker (browser revalidates /sw.js fresh on
 *    the next navigation — no stale worker can serve old shells).
 * 6. Reload the same URL with a cache-bust query param so the HTML itself
 *    comes from the network instead of the HTTP cache.
 *
 * Cookies (httpOnly auth session) are never read or written here.
 */

import { SAFE_REFRESH_CONFIG } from "@/app/lib/config/safeRefresh";
import { SITE_NOTICE_CONFIG } from "@/app/lib/config/siteNotice";

function isProtectedKey(key: string): boolean {
  if (SAFE_REFRESH_CONFIG.preserveLocalStorageKeys.includes(key)) return true;
  return SAFE_REFRESH_CONFIG.preserveLocalStoragePrefixes.some((p) =>
    key.startsWith(p),
  );
}

/**
 * Record that a safe refresh was completed, so the "kindly refresh" strip
 * (admin `refreshNotice`) stops nagging this browser within the TTL. Written
 * BEFORE the storage clear — the key is on the preserve whitelist so it
 * survives the wipe below. Private-mode failures are non-fatal.
 */
function markRefreshCompleted(): void {
  try {
    window.localStorage.setItem(
      SITE_NOTICE_CONFIG.refresh.completedAtKey,
      String(Date.now()),
    );
  } catch {
    /* private-mode / blocked storage — strip simply shows again next load */
  }
}

function clearWebStorage(storage: Storage, preserve: boolean): void {
  try {
    if (!preserve) {
      storage.clear();
      return;
    }
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && !isProtectedKey(key)) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
  } catch {
    /* private-mode / blocked storage — nothing to clear */
  }
}

async function clearCacheStorage(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const names = await caches.keys();
    await Promise.allSettled(names.map((name) => caches.delete(name)));
  } catch {
    /* unsupported or blocked — the SW unregister + cache-bust still help */
  }
}

async function unregisterServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations.map((registration) => registration.unregister()),
    );
  } catch {
    /* no SW / blocked — reload still busts the HTTP cache */
  }
}

/** Build the cache-busted navigation URL for the current location. */
export function buildFreshHref(search: string, param: string): string {
  try {
    const params = new URLSearchParams(search);
    params.set(param, Date.now().toString(36));
    return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  } catch {
    return `${window.location.pathname}?${param}=${Date.now().toString(36)}`;
  }
}

let inFlight = false;

/**
 * Run the full safe-refresh sequence, then navigate. Returns false when a
 * refresh is already running (double-click guard); true once the sequence
 * has been kicked off (the page is about to unload).
 */
export async function safeClientRefresh(): Promise<boolean> {
  if (inFlight) return false;
  inFlight = true;
  try {
    // Record completion first — the once-flag key is preserve-whitelisted
    // so it survives the localStorage sweep immediately below.
    markRefreshCompleted();
    clearWebStorage(window.localStorage, true);
    if (SAFE_REFRESH_CONFIG.clearSessionStorage) {
      clearWebStorage(window.sessionStorage, false);
    }
    await clearCacheStorage();
    await unregisterServiceWorkers();
    const href = buildFreshHref(
      window.location.search,
      SAFE_REFRESH_CONFIG.cacheBustParam,
    );
    window.location.replace(href);
    return true;
  } catch {
    // Last-ditch: still try a plain reload so the user isn't stuck.
    try {
      window.location.reload();
    } catch {
      /* navigation blocked — nothing more we can do client-side */
    }
    return true;
  } finally {
    // If navigation is blocked, allow a retry after a beat.
    setTimeout(() => {
      inFlight = false;
    }, 2_000);
  }
}
