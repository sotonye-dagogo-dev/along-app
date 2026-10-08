"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Generic bulk-selection state with select-all / invert / undo / clear
 * plus "first N" quick presets. Undo restores the previous selection set.
 */
export function useBulkSelection<T>(items: T[], getId: (item: T, index: number) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [historyDepth, setHistoryDepth] = useState(0);
  const historyRef = useRef<Set<string>[]>([]);

  const pushHistory = useCallback((prev: Set<string>) => {
    historyRef.current.push(new Set(prev));
    if (historyRef.current.length > 20) historyRef.current.shift();
    setHistoryDepth(historyRef.current.length);
  }, []);

  const ids = items.map(getId);

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      pushHistory(prev);
      return new Set(ids);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const clear = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      pushHistory(prev);
      return new Set();
    });
  }, [pushHistory]);

  const invert = useCallback(() => {
    setSelected((prev) => {
      pushHistory(prev);
      const next = new Set<string>();
      for (const id of ids) if (!prev.has(id)) next.add(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const undo = useCallback(() => {
    const last = historyRef.current.pop();
    setHistoryDepth(historyRef.current.length);
    if (last) setSelected(new Set(last));
  }, []);

  const selectFirstN = useCallback(
    (n: number) => {
      setSelected((prev) => {
        pushHistory(prev);
        return new Set(ids.slice(0, n));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, pushHistory]
  );

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        pushHistory(prev);
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [pushHistory]
  );

  const canUndo = historyDepth > 0;

  return { selected, setSelected, selectAll, clear, invert, undo, selectFirstN, toggle, canUndo, count: selected.size };
}
