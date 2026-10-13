"use client";

import { useCallback, useRef, useState } from "react";
import { ADMIN_PAGINATION_META } from "@/app/lib/config/admin";

/**
 * Bulk-safe cursor pagination for admin tables (config-driven).
 * - APPENDS windows (never replaces) so `useBulkSelection`'s id Set survives
 *   "view more" — this is the fix for the deferred bulk-select state risk.
 * - `reset` on filter/sort change replaces the list AND clears nothing else;
 *   callers decide whether to clear selection (filter change ⇒ stale ids).
 * - Dedupes by id so overlapping windows (concurrent writes) never duplicate.
 */
export function useAdminCursorList<T extends { id: string }>(opts: {
  buildUrl: (cursor: string | null) => string;
  getItems: (payload: unknown) => T[];
  getCursor: (payload: unknown) => string | null;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef(false);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const load = useCallback(
    async (reset = true, cursor: string | null = null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetch(optsRef.current.buildUrl(reset ? null : cursor));
        if (!res.ok) throw new Error("Request failed");
        const payload: unknown = await res.json();
        const fresh = optsRef.current.getItems(payload);
        const cursorOut = optsRef.current.getCursor(payload);
        setItems((prev) => {
          if (reset) return fresh;
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...fresh.filter((i) => !seen.has(i.id))];
        });
        setNextCursor(cursorOut);
      } catch (err) {
        console.error("[AdminError]", err);
        if (reset) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        inFlight.current = false;
      }
    },
    []
  );

  const removeByIds = useCallback((ids: Set<string> | string[]) => {
    const gone = ids instanceof Set ? ids : new Set(ids);
    if (gone.size === 0) return;
    setItems((prev) => prev.filter((i) => !gone.has(i.id)));
  }, []);

  return {
    items,
    setItems,
    nextCursor,
    loading,
    loadingMore,
    pageSize: ADMIN_PAGINATION_META.defaultLimit,
    load,
    removeByIds,
  };
}
