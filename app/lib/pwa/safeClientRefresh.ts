"use client";

/**
 * Safe client refresh — clears stale caches + reboots the service worker
 * WITHOUT dropping the user's session, drafts, or preferences, and without
 * requiring a PWA reinstall.
 *
 * Sequence (every step try/catch fail-open; a failure never blocks the
 * reload — worst case the next load just re-fetches something extra):
 * 1. Clear non-protected localStorage (drafts/session/prefs survive).
 * 2. Clear sessionStorage (transient notice-dismiss state only).
 * 3. Delete every Cache Storage cache (SW-held API/page/image caches).
 * 4. Unregister every service worker (browser revalidates /sw.js fresh on
 *    the next navigation — no stale worker can serve old shells).
 * 5. Reload the same URL with a cache-bust query param so the HTML itself
 *    comes from the network instead of the HTTP cache.
 *
 * Cookies (httpOnly auth session) are never read or written here.
 */

import { SAFE_REFRESH_CONFIG } from "@/app/lib/config/safeRefresh";

function isProtectedKey(key: string): boolean {
  if (SAFE_REFRESH_CONFIG.preserveLocalStorageKeys.includes(key)) return true;
  return SAFE_REFRESH_CONFIG.preserveLocalStoragePrefixes.some((p) =>
    key.startsWith(p),
  );
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
