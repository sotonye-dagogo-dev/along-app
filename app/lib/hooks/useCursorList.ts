"use client";

/**
 * Config-driven cursor list for tabbed surfaces (profile tabs et al).
 *
 * - First page is scoped by `cacheKey` and kept in `memoryCache` (same
 *   envelope + retention as `useCachedFetch`) so returning to a tab paints
 *   instantly — and `buildUrl(null)` should therefore return the exact URL
 *   the old cached fetch used.
 * - A `cacheKey` change (profile tab switch) resets items synchronously
 *   during render, so the previous tab's rows never flash.
 * - `loadMore()` appends the next cursor window with order-preserving
 *   dedupe by id; an empty/absent `nextCursor` ends the list. Never
 *   double-fetches (in-flight guard).
 * - `mutate()` applies an optimistic updater to the whole visible list and
 *   writes it through the cache, so delete/archive reflections survive tab
 *   switches within the freshness window (parity with useCachedFetch.mutate).
 * - Stale cached data is shown while a silent first-page revalidation runs;
 *   appended windows are preserved when it lands (no shrink flash).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";

interface Envelope<T> {
  data: T;
  fetchedAt: number;
}

/** Retention window — mirrors useCachedFetch so tab lists stay warm. */
const RETENTION_SEC = 1800;
/** Freshness window for the cached first page (parity with profile tabs). */
const DEFAULT_TTL_SEC = 120;

/** Concurrent first-page callers for the same key share one request. */
const firstPageInFlight = new Map<string, Promise<unknown>>();

export interface CursorListPage<Item> {
  items: Item[];
  nextCursor: string | null;
}

export interface UseCursorListOptions<Item> {
  /** Skip fetching entirely (auth loading / tab owns its own panel). */
  enabled?: boolean;
  /** Cache scope — changing it (tab switch) resets the list before paint. */
  cacheKey: string | null;
  /** First-page URL when cursor is null; cursor-paged URL otherwise. */
  buildUrl: (cursor: string | null) => string;
  /** Split an API payload into ordered items + next-page cursor. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extract: (data: any) => CursorListPage<Item>;
  /** Freshness window in seconds for the cached first page (default 120). */
  ttlSec?: number;
  /** Dedupe identity (default `item.id`). */
  getItemId?: (item: Item) => string;
}

export interface UseCursorListResult<Item> {
  items: Item[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Fetch the next window (no-ops while one is already running). */
  loadMore: () => Promise<void>;
  /** Optimistically replace the visible list (write-through cache). */
  mutate: (updater: Item[] | ((prev: Item[]) => Item[])) => void;
}

interface ListState<Item> {
  items: Item[];
  cursor: string | null;
}

interface ScopeState<Item> extends ListState<Item> {
  loading: boolean;
}

export function useCursorList<Item extends { id: string }>(
  options: UseCursorListOptions<Item>,
): UseCursorListResult<Item> {
  const { cacheKey, enabled = true, ttlSec = DEFAULT_TTL_SEC } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const idOf = options.getItemId ?? ((item: Item) => item.id);
  const idOfRef = useRef(idOf);
  idOfRef.current = idOf;

  const seqRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const stateRef = useRef<ScopeState<Item>>({ items: [], cursor: null, loading: false });

  const readCached = (key: string | null): ListState<Item> | null => {
    if (!key) return null;
    return memoryCache.get<Envelope<ListState<Item>>>(key)?.data ?? null;
  };

  const initScope = (key: string | null, isEnabled: boolean): ScopeState<Item> => {
    if (!key || !isEnabled) return { items: [], cursor: null, loading: false };
    const cached = readCached(key);
    if (cached) {
      return { items: cached.items ?? [], cursor: cached.cursor ?? null, loading: false };
    }
    return { items: [], cursor: null, loading: true };
  };

  const [scope, setScope] = useState<{ key: string | null; enabled: boolean }>({
    key: cacheKey,
    enabled,
  });
  const [state, setState] = useState<ScopeState<Item>>(() => initScope(cacheKey, enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  stateRef.current = state;

  // Reset synchronously during render when the scope changes — the previous
  // tab's items must not flash for a frame (useCachedFetch resets in effects,
  // which paints one stale frame; this avoids that).
  if (scope.key !== cacheKey || scope.enabled !== enabled) {
    setScope({ key: cacheKey, enabled });
    setState(initScope(cacheKey, enabled));
  }

  const applyList = useCallback(
    (next: ListState<Item>, opts: { loading?: boolean; persist?: boolean } = {}) => {
      const { loading = false, persist = true } = opts;
      const key = cacheKeyRef.current;
      if (persist && key && enabledRef.current) {
        memoryCache.set<Envelope<ListState<Item>>>(
          key,
          { data: { items: next.items, cursor: next.cursor }, fetchedAt: Date.now() },
          RETENTION_SEC,
        );
      }
      const full: ScopeState<Item> = { items: next.items, cursor: next.cursor, loading };
      stateRef.current = full;
      setState(full);
    },
    [],
  );

  const fetchFirst = useCallback(
    async (silent: boolean, seq: number) => {
      const key = cacheKeyRef.current;
      if (!key || !enabledRef.current) return;
      const url = optionsRef.current.buildUrl(null);
      try {
        let promise = firstPageInFlight.get(key) as Promise<unknown> | undefined;
        if (!promise) {
          promise = (async () => {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            return await res.json();
          })();
          firstPageInFlight.set(key, promise);
          void promise
            .catch(() => undefined)
            .finally(() => firstPageInFlight.delete(key));
        }
        const payload = await promise;
        if (seq !== seqRef.current) return;
        const page = optionsRef.current.extract(payload);
        const incoming: ListState<Item> = {
          items: Array.isArray(page?.items) ? page.items : [],
          cursor: page?.nextCursor ?? null,
        };
        const prev = stateRef.current;
        // Silent revalidation landed a shorter first page than what is on
        // screen (user had paged forward): keep appended windows instead of
        // shrinking the list under them.
        if (silent && prev.items.length > incoming.items.length) {
          const seen = new Set(incoming.items.map((i) => idOfRef.current(i)));
          const merged = [...incoming.items];
          for (const item of prev.items) {
            const id = idOfRef.current(item);
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push(item);
          }
          applyList({ items: merged, cursor: prev.cursor });
        } else {
          applyList(incoming);
        }
      } catch {
        if (seq !== seqRef.current) return;
        // Offline / failure with cached data: stay on stale (parity with
        // useCachedFetch — the OfflineBanner already explains state).
        const prev = stateRef.current;
        applyList({ items: prev.items, cursor: prev.cursor }, { persist: false });
      }
    },
    [applyList],
  );

  useEffect(() => {
    const seq = ++seqRef.current;
    if (!cacheKey || !enabled) return;
    const envelope = memoryCache.get<Envelope<ListState<Item>>>(cacheKey);
    if (envelope?.data) {
      const fresh = Date.now() - envelope.fetchedAt < ttlSec * 1000;
      if (fresh) return;
      // Stale → keep showing data, revalidate silently.
      void fetchFirst(true, seq);
    } else {
      void fetchFirst(false, seq);
    }
  }, [cacheKey, enabled, ttlSec, fetchFirst]);

  const loadMore = useCallback(async () => {
    const key = cacheKeyRef.current;
    if (!key || !enabledRef.current) return;
    const { cursor } = stateRef.current;
    if (!cursor || appendInFlightRef.current) return;
    appendInFlightRef.current = true;
    const seq = seqRef.current;
    setLoadingMore(true);
    try {
      const res = await fetch(optionsRef.current.buildUrl(cursor), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("view more failed");
      const payload = await res.json();
      if (seq !== seqRef.current) return; // scope changed mid-flight
      const page = optionsRef.current.extract(payload);
      const incoming: Item[] = Array.isArray(page?.items) ? page.items : [];
      const prev = stateRef.current;
      const seen = new Set(prev.items.map((i) => idOfRef.current(i)));
      const merged = [...prev.items];
      for (const item of incoming) {
        const id = idOfRef.current(item);
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(item);
      }
      applyList({ items: merged, cursor: page?.nextCursor ?? null });
    } catch {
      // Silent — the button stays so the user can retry (canonical pattern).
    } finally {
      appendInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [applyList]);

  const mutate = useCallback(
    (updater: Item[] | ((prev: Item[]) => Item[])) => {
      const prev = stateRef.current;
      const nextItems =
        typeof updater === "function" ? (updater as (p: Item[]) => Item[])(prev.items) : updater;
      applyList({ items: nextItems, cursor: prev.cursor }, { loading: prev.loading });
    },
    [applyList],
  );

  return {
    items: state.items,
    loading: state.loading,
    loadingMore,
    hasMore: state.cursor !== null,
    loadMore,
    mutate,
  };
}
