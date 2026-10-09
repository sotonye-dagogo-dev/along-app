"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { toastService } from "@/app/lib/services/toastService";
import {
  getPushSupport,
  subscribeToPushDetailed,
} from "@/app/lib/utils/pushClient";
import {
  PUSH_PROMPT_CONFIG,
  isLikelyIos,
  type PushSubscribeReason,
} from "@/app/lib/config/pushPrompt";

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
  } catch { /* private-mode safe */ }
}

/**
 * Push opt-in notice — event-handled end to end:
 * - Enable actually subscribes (permission request inside the click
 *   gesture), reports per-outcome feedback, and clears on success.
 * - Local flags (`along-push-enabled`, dismissal timestamp) hide the notice
 *   when it isn't needed — even offline, where server state is unreachable.
 * - Denied/unsupported/offline outcomes render guidance instead of silence
 *   (iOS install hint included). Never throws; SSR-safe.
 */
export function PushManager() {
  const auth = useContext(AuthContext);
  const { isOnline } = useOnlineStatus();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [locallyEnabled, setLocallyEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failure, setFailure] = useState<PushSubscribeReason | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const copy = PUSH_PROMPT_CONFIG.copy;

  useEffect(() => {
    try {
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    } catch { /* ignore */ }
    setLocallyEnabled(readLocal(PUSH_PROMPT_CONFIG.storage.enabledKey) === "1");
    const dismissedAt = Number(readLocal(PUSH_PROMPT_CONFIG.storage.dismissedAtKey) ?? "0");
    if (dismissedAt > 0 && Date.now() - dismissedAt < PUSH_PROMPT_CONFIG.storage.dismissTtlMs) {
      setDismissed(true);
    }
    if (!getPushSupport().supported) setUnsupported(true);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/push/status");
      if (!res.ok) return;
      const data = await res.json();
      const subscribed = !!data.subscribed;
      setEnabled(subscribed);
      if (subscribed) writeLocal(PUSH_PROMPT_CONFIG.storage.enabledKey, "1");
    } catch { /* offline — local flags decide */ }
  }, []);

  useEffect(() => {
    if (auth?.isAuthenticated) void checkStatus();
    else setEnabled(null);
  }, [auth?.isAuthenticated, checkStatus]);

  // Surface a freshly-denied browser permission as guidance (once).
  useEffect(() => {
    if (permission === "denied") setFailure((f) => f ?? "denied");
  }, [permission]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeLocal(PUSH_PROMPT_CONFIG.storage.dismissedAtKey, String(Date.now()));
  }, []);

  const enable = useCallback(async () => {
    if (busy) return;
    if (!isOnline) {
      toastService.error(copy.offline);
      return;
    }
    const support = getPushSupport();
    if (!support.supported) {
      setUnsupported(true);
      setFailure(support.reason ?? "unsupported");
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const r = await subscribeToPushDetailed();
      try {
        if (typeof Notification !== "undefined") setPermission(Notification.permission);
      } catch { /* ignore */ }
      if (r.ok) {
        setEnabled(true);
        setLocallyEnabled(true);
        writeLocal(PUSH_PROMPT_CONFIG.storage.enabledKey, "1");
        toastService.success(copy.enabledToast);
        return;
      }
      if (r.reason === "denied") {
        setFailure("denied");
        return;
      }
      if (r.reason === "dismissed-permission") {
        // User closed the browser prompt without choosing — keep the notice
        // so they can retry, with a nudge rather than an error.
        setFailure("dismissed-permission");
        return;
      }
      setFailure(r.reason);
    } finally {
      setBusy(false);
    }
  }, [busy, isOnline, copy]);

  if (!auth?.isAuthenticated) return null;
  if (enabled === true || locallyEnabled) return null;
  if (dismissed && !failure) return null;
  if (unsupported && !failure) return null;

  const failureLine =
    failure === "denied" || permission === "denied"
      ? copy.denied
      : failure === "offline"
        ? copy.offline
        : failure === "no-vapid"
          ? copy.noVapid
          : failure === "unsupported" || failure === "insecure-context" || failure === "no-service-worker"
            ? copy.unsupported
            : failure === null
              ? null
              : copy.failed;
  const helpLine =
    typeof navigator !== "undefined" && isLikelyIos(navigator.userAgent)
      ? copy.iosHelp
      : copy.deniedHelp;

  return (
    <div
      role="note"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        background: "var(--info-soft, #e8f1ff)",
        color: "var(--info-ink, #1d4ed8)",
        fontSize: 13,
        marginBottom: 10,
      }}
    >
      <span style={{ flex: 1 }}>
        {failureLine ?? copy.prompt}
        {(failure === "denied" || permission === "denied" || showHelp) && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.9 }}>{helpLine}</span>
        )}
      </span>
      {!failureLine || failure === "dismissed-permission" ? (
        <button
          onClick={() => void enable()}
          disabled={busy || !isOnline}
          title={!isOnline ? copy.offline : copy.enable}
          style={{
            background: "var(--brand, #00623B)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontWeight: 600,
            cursor: busy || !isOnline ? "not-allowed" : "pointer",
            opacity: busy || !isOnline ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {busy ? copy.enabling : failure === "dismissed-permission" ? "Try again" : copy.enable}
        </button>
      ) : (
        <button
          onClick={() => void enable()}
          disabled={busy || !isOnline}
          style={{
            background: "transparent",
            color: "inherit",
            border: "1px solid currentColor",
            borderRadius: 8,
            padding: "6px 12px",
            fontWeight: 600,
            cursor: busy || !isOnline ? "not-allowed" : "pointer",
            opacity: busy || !isOnline ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {busy ? copy.enabling : "Retry"}
        </button>
      )}
      {failureLine && failure !== "dismissed-permission" && (
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-label={copy.howTo}
          title={copy.howTo}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14 }}
        >
          ?
        </button>
      )}
      <button
        onClick={dismiss}
        disabled={busy}
        aria-label={copy.dismissed}
        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14 }}
      >
        ✕
      </button>
    </div>
  );
}
