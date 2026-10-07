"use client";

/**
 * Read-through cached fetch with stale-while-revalidate semantics.
 *
 * - Cached data renders instantly on mount/navigation (no skeleton flash).
 * - While fresh (ttlSec) no network request is made at all.
 * - When stale: cached data stays on screen while a silent revalidation runs.
 * - Concurrent callers for the same key share one in-flight request.
 * - `mutate()` lets callers update state + cache optimistically.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";

interface Envelope<T> {
  data: T;
  fetchedAt: number;
}

/** Retention window — how long stale data stays available for SWR. */
const RETENTION_SEC = 1800;

const inFlight = new Map<string, Promise<unknown>>();

export interface UseCachedFetchOptions {
  /** Freshness window in seconds (default 60). */
  ttlSec?: number;
  /** Skip fetching entirely (e.g. waiting for auth). */
  enabled?: boolean;
}

export interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Force a network fetch (ignores freshness) and update the cache. */
  refetch: () => Promise<void>;
  /** Optimistically replace data in state and cache. */
  mutate: (updater: T | ((prev: T | null) => T)) => void;
}

export function useCachedFetch<T>(
  key: string | null,
  url: string,
  options: UseCachedFetchOptions = {}
): UseCachedFetchResult<T> {
  const { ttlSec = 60, enabled = true } = options;

  const [data, setData] = useState<T | null>(() => {
    const envelope = key ? memoryCache.get<Envelope<T>>(key) : null;
    return envelope?.data ?? null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!key || !enabled) return false;
    return !memoryCache.get<Envelope<T>>(key);
  });
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const fetchNow = useCallback(
    async (silent: boolean) => {
      if (!key || !enabled) return;
      const seq = ++seqRef.current;
      if (!silent) setLoading(true);
      try {
        let promise = inFlight.get(key) as Promise<T> | undefined;
        if (!promise) {
          promise = (async () => {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            return (await res.json()) as T;
          })();
          inFlight.set(key, promise);
          void promise.catch(() => undefined).finally(() => inFlight.delete(key));
        }
        const result = await promise;
        if (seq !== seqRef.current) return;
        memoryCache.set<Envelope<T>>(key, { data: result, fetchedAt: Date.now() }, RETENTION_SEC);
        setData(result);
        setError(null);
      } catch (err) {
        if (seq !== seqRef.current) return;
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [key, url, enabled]
  );

  useEffect(() => {
    if (!key || !enabled) {
      setLoading(false);
      return;
    }
    const envelope = memoryCache.get<Envelope<T>>(key);
    if (envelope) {
      setData(envelope.data);
      const fresh = Date.now() - envelope.fetchedAt < ttlSec * 1000;
      if (fresh) {
        setLoading(false);
        setError(null);
        return;
      }
      // stale → keep showing data, revalidate silently
      void fetchNow(true);
    } else {
      setData(null);
      void fetchNow(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ttlSec]);

  const refetch = useCallback(async () => {
    await fetchNow(false);
  }, [fetchNow]);

  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T)) => {
      setData((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater;
        if (key) memoryCache.set<Envelope<T>>(key, { data: next, fetchedAt: Date.now() }, RETENTION_SEC);
        return next;
      });
    },
    [key]
  );

  return { data, loading, error, refetch, mutate };
}
