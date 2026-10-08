"use client";

/**
 * Live unread-notification count for nav badges.
 * Polls the (60s-cached) notifications endpoint while the user is
 * authenticated; guests get 0 and no network traffic. Never throws —
 * a failed poll simply keeps the last known count.
 */

import { useCallback, useEffect, useState } from "react";
import { NOTIFICATION_BADGE_CONFIG } from "@/app/lib/config/navigation";

export function useUnreadNotifications(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(NOTIFICATION_BADGE_CONFIG.endpoint, {
        signal,
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount?: unknown };
      if (typeof data.unreadCount === "number" && data.unreadCount >= 0) {
        setCount(data.unreadCount);
      }
    } catch {
      /* keep last known count */
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    const controller = new AbortController();
    void fetchCount(controller.signal);
    const timer = setInterval(
      () => void fetchCount(),
      NOTIFICATION_BADGE_CONFIG.pollMs
    );
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled, fetchCount]);

  return count;
}

/** Renders "99+" past the configured cap. Pure helper, unit-tested. */
export function formatBadgeCount(count: number): string {
  if (count > NOTIFICATION_BADGE_CONFIG.maxDisplay) {
    return `${NOTIFICATION_BADGE_CONFIG.maxDisplay}+`;
  }
  return String(count);
}
