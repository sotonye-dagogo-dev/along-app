/**
 * Client/server-safe in-memory TTL cache.
 *
 * Mirrors the semantics of app/lib/db/redis.ts: never throws, lazy expiry,
 * small footprint. Used to keep routes/posts/suggestions hot across
 * navigations so pages don't constantly reload, and to memoize live
 * route-trace results in the share modal.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_SEC = 300;
const MAX_ENTRIES = 300;

class MemoryCache {
  private store = new Map<string, CacheEntry>();

  private sweep(now: number): void {
    if (this.store.size < MAX_ENTRIES) {
      // cheap lazy expiry only when we're not over capacity
      for (const [key, entry] of this.store) {
        if (entry.expiresAt <= now) this.store.delete(key);
      }
      return;
    }
    // Over capacity: drop expired, then oldest inserted (Map preserves insert order)
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    while (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get<T>(key: string): T | null {
    try {
      const entry = this.store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        this.store.delete(key);
        return null;
      }
      return entry.value as T;
    } catch {
      return null;
    }
  }

  set<T = unknown>(key: string, value: T, ttlSec: number = DEFAULT_TTL_SEC): void {
    try {
      this.sweep(Date.now());
      this.store.delete(key);
      this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    } catch {
      /* cache failures are non-critical */
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  del(...keys: string[]): void {
    for (const key of keys) {
      try {
        this.store.delete(key);
      } catch {
        /* ignore */
      }
    }
  }

  /** Invalidate every key starting with `prefix` (e.g. "feed:user123:"). */
  delPrefix(prefix: string): void {
    try {
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) this.store.delete(key);
      }
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    try {
      this.store.clear();
    } catch {
      /* ignore */
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const memoryCache = new MemoryCache();
