import { POST_SUBMIT_CONFIG } from "@/app/lib/config/postSubmit";

/**
 * In-memory idempotency store for POST /api/posts (never-throw).
 *
 * Guards against duplicate creates from double-clicks and client retries:
 * the first request with a key claims it (`claim` returns true); a replayed
 * key returns the stored post id so the route can re-fetch and return the
 * original response instead of inserting a second row.
 *
 * Process-local by design (serverless-safe: a replay that lands on a cold
 * instance simply misses and creates once — the client-side submit guard is
 * the primary dedup, this is the second layer). Entries expire after
 * `POST_SUBMIT_CONFIG.idempotencyTtlMs`; expiry is lazy on access plus an
 * opportunistic sweep on write.
 */
type Entry = { postId: string; expiresAt: number };

class IdempotencyService {
  private store = new Map<string, Entry>();

  private namespaced(key: string): string {
    return `${POST_SUBMIT_CONFIG.idempotencyKeyPrefix}${key}`;
  }

  private sweep(now: number): void {
    if (this.store.size === 0) return;
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
  }

  /** Claim a key. Returns true when this caller owns the mutation. */
  claim(rawKey: string, now: number = Date.now()): boolean {
    try {
      const key = rawKey.trim();
      if (!key) return true; // no key — nothing to dedup, allow through
      const namespaced = this.namespaced(key);
      const existing = this.store.get(namespaced);
      if (existing && existing.expiresAt > now) return false;
      this.sweep(now);
      this.store.set(namespaced, { postId: "", expiresAt: now + POST_SUBMIT_CONFIG.idempotencyTtlMs });
      return true;
    } catch {
      return true; // never block a post on store failure
    }
  }

  /** Record the created post id for a claimed key. */
  complete(rawKey: string, postId: string, now: number = Date.now()): void {
    try {
      const key = rawKey.trim();
      if (!key) return;
      const namespaced = this.namespaced(key);
      const existing = this.store.get(namespaced);
      this.store.set(namespaced, {
        postId,
        expiresAt: existing && existing.expiresAt > now
          ? existing.expiresAt
          : now + POST_SUBMIT_CONFIG.idempotencyTtlMs,
      });
    } catch {
      /* never-throw */
    }
  }

  /** Look up the post id for a replayed key, or null when unknown/expired. */
  replayOf(rawKey: string, now: number = Date.now()): string | null {
    try {
      const key = rawKey.trim();
      if (!key) return null;
      const entry = this.store.get(this.namespaced(key));
      if (!entry || entry.expiresAt <= now || !entry.postId) return null;
      return entry.postId;
    } catch {
      return null;
    }
  }

  /** Release a key (e.g. when creation failed and a retry should go through). */
  release(rawKey: string): void {
    try {
      const key = rawKey.trim();
      if (!key) return;
      this.store.delete(this.namespaced(key));
    } catch {
      /* never-throw */
    }
  }
}

export const idempotencyService = new IdempotencyService();
