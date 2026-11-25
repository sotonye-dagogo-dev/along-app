"use client";

/**
 * Visibility-aware interval — the shared timer used by every background
 * client poller (connectivity heartbeat, notification badge, site notices).
 *
 * Why: Vercel Fluid bills Active CPU per invocation, and a timer that keeps
 * firing in a hidden/backgrounded tab burns function compute for no user
 * benefit. This hook:
 * - runs the callback on `intervalMs` only while the document is visible;
 * - pauses the timer entirely when hidden;
 * - optionally fires one catch-up tick shortly after the tab becomes visible
 *   again, so data is fresh the moment the user returns.
 *
 * The callback is held in a ref so callers can pass an inline closure without
 * restarting the timer on every render. SSR-safe (no-ops without `window`).
 */

import { useEffect, useRef } from "react";
import { CLIENT_POLLING_CONFIG } from "@/app/lib/config/performance";

export function useVisibilityInterval(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (CLIENT_POLLING_CONFIG.pauseWhenHidden && document.visibilityState !== "visible") {
        return;
      }
      try {
        callbackRef.current();
      } catch {
        /* pollers own their error handling — never break the timer */
      }
    };

    const start = () => {
      if (interval === null) interval = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const cancelResume = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (CLIENT_POLLING_CONFIG.refreshOnVisible) {
          cancelResume();
          resumeTimer = setTimeout(() => {
            resumeTimer = null;
            tick();
          }, CLIENT_POLLING_CONFIG.resumeDelayMs);
        }
        start();
      } else if (CLIENT_POLLING_CONFIG.pauseWhenHidden) {
        stop();
        cancelResume();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      cancelResume();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
