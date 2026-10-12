"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/providers/I18nProvider";
import { toastService } from "@/app/lib/services/toastService";
import {
  PWA_INSTALL_CONFIG,
  isStandaloneDisplay,
} from "@/app/lib/config/pwa";
import { isLikelyIos } from "@/app/lib/config/pushPrompt";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
 * PWA install notice — global, non-interfering, config-driven.
 *
 * - Listens for `beforeinstallprompt` (Chromium/Android/desktop) and defers
 *   it; Install runs inside the click gesture so the browser sheet appears.
 * - No BIP (iOS/Firefox): renders manual guidance (Add to Home Screen /
 *   browser-menu install) instead of silence.
 * - Already-installed (standalone display-mode / `appinstalled` / local
 *   flag) or recently-dismissed (14-day TTL) → renders nothing.
 * - Fixed bottom card, collapsible to a corner pill, capped width, safe-area
 *   aware — never covers the offline banner or blocks interaction.
 * - Guests included (installing needs no account). Never throws; SSR-safe.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const copy = PWA_INSTALL_CONFIG.copy;
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
    try {
      if (isStandaloneDisplay()) {
        setInstalled(true);
        writeLocal(PWA_INSTALL_CONFIG.storage.installedKey, "1");
        return;
      }
      if (readLocal(PWA_INSTALL_CONFIG.storage.installedKey) === "1") {
        setInstalled(true);
        return;
      }
      const dismissedAt = Number(
        readLocal(PWA_INSTALL_CONFIG.storage.dismissedAtKey) ?? "0",
      );
      if (
        dismissedAt > 0 &&
        Date.now() - dismissedAt < PWA_INSTALL_CONFIG.storage.dismissTtlMs
      ) {
        setDismissed(true);
      }
    } catch {
      /* ignore — prompt stays visible as fallback */
    }

    const onBip = (e: Event) => {
      try {
        e.preventDefault();
      } catch {
        /* some browsers throw when already handled */
      }
      const bip = e as BeforeInstallPromptEvent;
      deferredRef.current = bip;
      setDeferred(bip);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      deferredRef.current = null;
      writeLocal(PWA_INSTALL_CONFIG.storage.installedKey, "1");
      try {
        toastService.success(copy.installedToast);
      } catch {
        /* toast is best-effort */
      }
    };
    try {
      window.addEventListener("beforeinstallprompt", onBip);
      window.addEventListener("appinstalled", onInstalled);
    } catch {
      /* non-critical */
    }
    return () => {
      try {
        window.removeEventListener("beforeinstallprompt", onBip);
        window.removeEventListener("appinstalled", onInstalled);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeLocal(PWA_INSTALL_CONFIG.storage.dismissedAtKey, String(Date.now()));
  }, []);

  const install = useCallback(async () => {
    const bip = deferredRef.current ?? deferred;
    if (!bip) {
      // No deferred prompt — nothing to trigger; show manual guidance.
      setShowHelp(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await bip.prompt();
      const choice = await bip.userChoice.catch(
        () => ({ outcome: "dismissed" }) as { outcome: "accepted" | "dismissed" },
      );
      if (choice.outcome === "accepted") {
        setInstalled(true);
        writeLocal(PWA_INSTALL_CONFIG.storage.installedKey, "1");
        try {
          toastService.success(copy.installedToast);
        } catch {
          /* ignore */
        }
      } else {
        dismiss();
      }
    } catch {
      setShowHelp(true);
    } finally {
      deferredRef.current = null;
      setDeferred(null);
      setBusy(false);
    }
  }, [busy, copy.installedToast, deferred, dismiss]);

  if (installed || dismissed) return null;

  const title = tt("pwa.installTitle", copy.title);
  const body = tt("pwa.installBody", copy.body);
  const installLabel = tt("pwa.installCta", copy.install);
  const laterLabel = tt("pwa.installLater", copy.later);
  let helpLine = copy.manualHelp;
  try {
    if (
      typeof navigator !== "undefined" &&
      isLikelyIos(navigator.userAgent)
    ) {
      helpLine = copy.iosHelp;
    }
  } catch {
    /* keep generic help */
  }

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
          bottom: 76,
          zIndex: 55,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid var(--border, #e5e7eb)",
          background: "var(--bg-base, #fff)",
          color: "var(--text-primary, #111827)",
          boxShadow: "0 8px 28px rgba(0,0,0,.18)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        <span aria-hidden>📲</span>
        {title}
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
        bottom: 76,
        zIndex: 55,
        margin: "0 auto",
        maxWidth: 480,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border, #e5e7eb)",
        background: "var(--bg-base, #fff)",
        color: "var(--text-primary, #111827)",
        boxShadow: "0 8px 28px rgba(0,0,0,.18)",
        fontSize: 13,
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1.2 }}>
        📲
      </span>
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
        {(showHelp || !deferred) && (
          <span
            style={{
              display: "block",
              marginTop: 6,
              fontSize: 12,
              opacity: 0.9,
              lineHeight: 1.45,
            }}
          >
            {helpLine}
          </span>
        )}
      </span>
      <span
        style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}
      >
        {deferred ? (
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy}
            style={{
              background: "var(--brand, #00623B)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {busy ? copy.installing : installLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label={copy.howTo}
            title={copy.howTo}
            style={{
              background: "transparent",
              color: "inherit",
              border: "1px solid currentColor",
              borderRadius: 8,
              padding: "6px 12px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ?
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          aria-label={copy.dismissed}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            opacity: 0.8,
          }}
        >
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
          }}
        >
          ↓
        </button>
      </span>
    </div>
  );
}
