"use client";

import { useEffect } from "react";
import { PWA_UPDATE_CONFIG } from "@/app/lib/config/pwa";

/**
 * Registers /sw.js, polls for updates, and reloads exactly once per update.
 *
 * - Periodically calls `registration.update()` (interval + on
 *   visible/focus/online, per PWA_UPDATE_CONFIG) so long-lived installed
 *   sessions discover new versions without waiting for a navigation.
 * - Never force-reloads: when a waiting worker appears AND the page is
 *   already controlled, it dispatches PWA_UPDATE_CONFIG.updateReadyEvent and
 *   leaves the decision to ServiceWorkerUpdatePrompt (user taps Update →
 *   SKIP_WAITING → controllerchange → single reload).
 * - First install (no controller): nothing to prompt; the worker claims and
 *   the page keeps running.
 * - Reload loop-guard: sessionStorage flag per update episode; offline-safe,
 *   SSR-safe, never throws. Auth/session untouched (SW never caches auth).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    try {
      // Dev guard: registering the prod SW under `next dev` caches HMR
      // chunks and stale app-shells. Opt-in via NEXT_PUBLIC_ENABLE_SW_IN_DEV.
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV !== "true"
      ) {
        return;
      }
    } catch {
      // env read failed — fall through and attempt registration
    }
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let updateAnnounced = false;
    let wasControlledAtStart = false;

    const announceUpdateReady = (version?: string) => {
      updateAnnounced = true;
      try {
        window.dispatchEvent(
          new CustomEvent(PWA_UPDATE_CONFIG.updateReadyEvent, {
            detail: { version: version ?? null },
          }),
        );
      } catch {
        /* event dispatch is best-effort */
      }
    };

    const hasController = () => {
      try {
        return Boolean(navigator.serviceWorker.controller);
      } catch {
        return false;
      }
    };

    const handleWaiting = (worker: ServiceWorker | null, version?: string) => {
      if (!worker || cancelled) return;
      // First install — no controlled page yet, no prompt needed.
      if (!hasController()) return;
      announceUpdateReady(version);
    };

    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(PWA_UPDATE_CONFIG.storage.reloadedKey) === "1") return;
        sessionStorage.setItem(PWA_UPDATE_CONFIG.storage.reloadedKey, "1");
      } catch {
        /* private-mode: reload anyway, single controllerchange fires once */
      }
      try {
        window.location.reload();
      } catch {
        /* ignore */
      }
    };

    const onControllerChange = () => {
      if (cancelled) return;
      // Reload only for an update takeover (prompt announced, or a previous
      // controller existed) — never on first install (none → worker).
      if (!updateAnnounced && !wasControlledAtStart) return;
      reloadOnce();
    };

    // Guard: a fresh page load already running the newest SW still sees a
    // stale sessionStorage flag from the previous episode — clear it once we
    // know this load is controlled and settled, so the NEXT update can reload.
    const armReloadGuard = () => {
      try {
        if (hasController()) {
          window.setTimeout(() => {
            try {
              sessionStorage.removeItem(PWA_UPDATE_CONFIG.storage.reloadedKey);
            } catch {
              /* ignore */
            }
          }, 5_000);
        }
      } catch {
        /* ignore */
      }
    };

    let registrationRef: ServiceWorkerRegistration | null = null;

    const checkForUpdate = () => {
      try {
        if (cancelled || !navigator.onLine) return;
        void registrationRef?.update().catch(() => {});
      } catch {
        /* update check is best-effort */
      }
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        registrationRef = reg;
        wasControlledAtStart = hasController();
        // Update already waiting from a previous load (e.g. install while away).
        if (reg.waiting) handleWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              handleWaiting(reg.waiting ?? worker);
            }
          });
        });
        // Periodic + event-driven revalidation (cheap, offline-skipped).
        try {
          intervalId = setInterval(checkForUpdate, PWA_UPDATE_CONFIG.checkIntervalMs);
        } catch {
          /* ignore */
        }
        try {
          if (PWA_UPDATE_CONFIG.checkOnVisible) {
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") checkForUpdate();
            });
            window.addEventListener("focus", checkForUpdate);
          }
          if (PWA_UPDATE_CONFIG.checkOnOnline) {
            window.addEventListener("online", checkForUpdate);
          }
        } catch {
          /* listeners are best-effort */
        }
        // SW-initiated broadcasts (SW_UPDATE_READY / SW_ACTIVATED) also land here.
        try {
          navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
            const data = (event as MessageEvent).data as
              | { type?: string; version?: string }
              | null;
            if (!data || typeof data !== "object") return;
            if (data.type === "SW_UPDATE_READY") {
              handleWaiting(reg.waiting, data.version);
            }
          });
        } catch {
          /* ignore */
        }
        armReloadGuard();
      })
      .catch(() => {});

    try {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      try {
        if (intervalId) clearInterval(intervalId);
      } catch {
        /* ignore */
      }
      try {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
