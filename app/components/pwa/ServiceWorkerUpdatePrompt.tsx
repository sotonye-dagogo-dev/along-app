"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/app/providers/I18nProvider";
import { toastService } from "@/app/lib/services/toastService";
import {
  PWA_UPDATE_CONFIG,
  PWA_SW_MESSAGES,
} from "@/app/lib/config/pwa";
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private-mode safe */
  }
}

/**
 * Service-worker update prompt — global, non-interfering, config-driven.
 *
 * - Listens for PWA_UPDATE_CONFIG.updateReadyEvent (dispatched by
 *   ServiceWorkerRegistrar when a waiting worker is found, periodically
 *   re-checked via registration.update()).
 * - Update posts SKIP_WAITING to the waiting worker; the resulting
 *   `controllerchange` reloads the page exactly once (guard lives in the
 *   registrar). No force-reload, no loops, session preserved (auth APIs are
 *   never cached by the SW).
 * - Recently-dismissed (TTL) → renders nothing; re-prompts after the TTL.
 * - Fixed bottom card on the transient lane (above install/offline),
 *   collapsible to a corner pill, capped width, safe-area aware. Guests
 *   included. Never throws.
 */
export function ServiceWorkerUpdatePrompt() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  const tt = useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key);
        return v === key ? fallback : v;
      } catch {
        return fallback;
      }
    },
    [t],
  );

  useEffect(() => {
    const isDismissedRecently = () => {
      try {
        const dismissedAt = Number(
          readLocal(PWA_UPDATE_CONFIG.storage.dismissedAtKey) ?? "0",
        );
        return (
          dismissedAt > 0 &&
          Date.now() - dismissedAt < PWA_UPDATE_CONFIG.storage.dismissTtlMs
        );
      } catch {
        return false;
      }
    };
    if (isDismissedRecently()) {
      setDismissed(true);
    }
    const onReady = () => {
      // A re-dispatched event lifts an expired snooze; an active one holds.
      if (isDismissedRecently()) return;
      setDismissed(false);
      setReady(true);
    };
    // Self-healing: a reload may land on an already-waiting worker with no
    // fresh updatefound to re-announce it (e.g. snooze expired overnight).
    // A mount-time check re-surfaces the prompt without waiting for the
    // next version bump.
    try {
      if ("serviceWorker" in navigator && !isDismissedRecently()) {
        void navigator.serviceWorker
          .getRegistration()
          .then((reg) => {
            try {
              if (
                reg?.waiting &&
                Boolean(navigator.serviceWorker.controller)
              ) {
                setDismissed(false);
                setReady(true);
              }
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      }
    } catch {
      /* non-critical */
    }
    try {
      window.addEventListener(PWA_UPDATE_CONFIG.updateReadyEvent, onReady);
    } catch {
      /* non-critical */
    }
    return () => {
      try {
        window.removeEventListener(PWA_UPDATE_CONFIG.updateReadyEvent, onReady);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setReady(false);
    writeLocal(PWA_UPDATE_CONFIG.storage.dismissedAtKey, String(Date.now()));
  }, []);

  const applyUpdate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator)) {
        try {
          window.location.reload();
        } catch {
          /* ignore */
        }
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      const waiting = reg?.waiting;
      if (waiting) {
        try {
          waiting.postMessage(PWA_SW_MESSAGES.skipWaiting);
        } catch {
          /* postMessage failed — fall back to plain reload */
          try {
            window.location.reload();
          } catch {
            /* ignore */
          }
          return;
        }
        // Safety net: if controllerchange doesn't fire (stale browser),
        // reload after a short grace so the user isn't stuck.
        window.setTimeout(() => {
          try {
            if (document.visibilityState === "visible") window.location.reload();
          } catch {
            /* ignore */
          }
        }, 8_000);
        try {
          toastService.success(PWA_UPDATE_CONFIG.copy.updatedToast);
        } catch {
          /* toast is best-effort */
        }
        return;
      }
      // No waiting worker (already activated) — plain refresh picks it up.
      try {
        window.location.reload();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (!ready || dismissed) return null;

  const transientLane = laneBottom(FLOATING_UI_CONFIG.lanes.transientBottomPx);
  const copy = PWA_UPDATE_CONFIG.copy;
  const title = tt("pwa.updateTitle", copy.title);
  const body = tt("pwa.updateBody", copy.body);
  const updateLabel = tt("pwa.updateCta", copy.update);
  const laterLabel = tt("pwa.updateLater", copy.later);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-expanded={false}
        aria-label={title}
        title={title}
          style={{
            position: "fixed",
            right: 12,
            bottom: transientLane,
            zIndex: 55,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid var(--color-border, #E5E7EB)",
          background: "var(--color-bg-card, #FFFFFF)",
          color: "var(--color-text-primary, #1A1A1A)",
          boxShadow: "0 8px 28px rgba(0,0,0,.18)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        <RefreshCw size={14} aria-hidden />
        {title}
        <ChevronUp size={14} aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="note"
      aria-live="polite"
      aria-label={title}
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: transientLane,
        zIndex: 55,
        margin: "0 auto",
        maxWidth: 480,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--color-border, #E5E7EB)",
        background: "var(--color-bg-card, #FFFFFF)",
        color: "var(--color-text-primary, #1A1A1A)",
        boxShadow: "0 8px 28px rgba(0,0,0,.18)",
        fontSize: 13,
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <RefreshCw size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700 }}>{title}</span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            opacity: 0.85,
            lineHeight: 1.45,
          }}
        >
          {body}
        </span>
      </span>
      <span
        style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}
      >
        <button
          type="button"
          onClick={() => void applyUpdate()}
          disabled={busy}
          style={{
            background: "var(--color-primary, #00623B)",
            color: "var(--color-text-inverse, #FFFFFF)",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {busy ? copy.updating : updateLabel}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          aria-label={copy.dismissed}
          title={copy.dismissed}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            opacity: 0.8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "inherit",
          }}
        >
          <X size={14} aria-hidden />
          {laterLabel}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label={tt("pwa.collapse", "Minimize")}
          title={tt("pwa.collapse", "Minimize")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            opacity: 0.7,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "inherit",
          }}
        >
          <ChevronDown size={14} aria-hidden />
          {tt("pwa.collapse", "Minimize")}
        </button>
      </span>
    </div>
  );
}
