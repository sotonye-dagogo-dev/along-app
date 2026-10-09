"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once, prompts on updates (no force-reload loops), and
 * relays SW background-sync flush requests to the foreground queue owner.
 * Lightweight: single registration, no polling, no perf impact.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        // Ask an updated SW to take over only when the page next loads —
        // never force-reload under the user (core behaviour preserved).
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
