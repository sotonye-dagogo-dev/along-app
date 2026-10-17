"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { toastService } from "@/app/lib/services/toastService";
import { PWA_FAQ_LINKS } from "@/app/lib/config/pwa";
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi";
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
 *
 * Variants (non-breaking additive):
 * - `inline` (default): in-flow banner for the notifications page — keeps
 *   the existing detailed settings placement.
 * - `floating`: fixed bottom card for global layout mounting — collapsible
 *   to a pill, suppressed on /notifications (inline already covers it), so
 *   authenticated users actually discover push without duplication or
 *   interaction blocking.
 */
export function PushManager({ variant = "inline" }: { variant?: "inline" | "floating" }) {
  const auth = useContext(AuthContext);
  // Always called (rules of hooks); only consumed by the floating variant.
  const pathname = usePathname();
  const { isOnline } = useOnlineStatus();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [locallyEnabled, setLocallyEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failure, setFailure] = useState<PushSubscribeReason | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // iOS is read from the UA once after mount — never during render, so the
  // server and client first paint always match (hydration #418, text nodes).
  const [isIos, setIsIos] = useState(false);

  const copy = PUSH_PROMPT_CONFIG.copy;
  // Opaque token surface (light + dark): solid card fill + info border +
  // primary text, so the notice never washes out the way the translucent
  // info fill did in dark mode. Tokens only — no hardcoded hex.
  const surface = PUSH_PROMPT_CONFIG.surface;

  useEffect(() => {
    try {
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    } catch { /* ignore */ }
    try {
      setIsIos(typeof navigator !== "undefined" && isLikelyIos(navigator.userAgent));
    } catch { /* generic help — keep false */ }
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
  // Floating global prompt defers to the inline banner on its home page.
  if (variant === "floating" && pathname?.startsWith("/notifications")) return null;

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
  // Derived from the effect-owned flag — the UA is never read in render, so
  // server HTML and the client's first paint always agree (hydration #418).
  const helpLine = isIos ? copy.iosHelp : copy.deniedHelp;

  // Floating variant: fixed bottom card on the transient lane (above the
  // install/offline lanes), collapsible to a pill so it never blocks
  // interaction. Same event handling, same local flags — only the chrome differs.
  const transientLane = laneBottom(FLOATING_UI_CONFIG.lanes.transientBottomPx);
  if (variant === "floating") {
    if (collapsed) {
      return (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label={copy.enable}
          title={copy.enable}
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
            border: `1px solid ${surface.border}`,
            background: surface.background,
            color: surface.text,
            boxShadow: "0 8px 28px rgba(0,0,0,.18)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <Bell size={14} aria-hidden style={{ color: surface.icon }} />
          {copy.enable}
          <ChevronUp size={14} aria-hidden />
        </button>
      );
    }
    return (
      <div
        role="note"
        aria-live="polite"
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
          border: `1px solid ${surface.border}`,
          background: surface.background,
          color: surface.text,
          boxShadow: "0 8px 28px rgba(0,0,0,.18)",
          fontSize: 13,
          paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <Bell size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: surface.icon }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {failureLine ?? copy.prompt}
          {(failure === "denied" || permission === "denied") && (
            <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.9 }}>{helpLine}</span>
          )}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => void enable()}
            disabled={busy || !isOnline}
            title={!isOnline ? copy.offline : copy.enable}
            style={{
              background: "var(--color-primary, #00623B)",
              color: "var(--color-text-inverse, #FFFFFF)",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              fontWeight: 600,
              cursor: busy || !isOnline ? "not-allowed" : "pointer",
              opacity: busy || !isOnline ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {busy ? copy.enabling : failure && failure !== "dismissed-permission" ? "Retry" : copy.enable}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Minimize"
            title="Minimize"
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.8, display: "inline-flex", alignItems: "center", gap: 4, color: "inherit" }}
          >
            <ChevronDown size={14} aria-hidden />
            Minimize
          </button>
          <button
            onClick={dismiss}
            disabled={busy}
            aria-label={copy.dismissed}
            title={copy.dismissed}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.8, display: "inline-flex", alignItems: "center", gap: 4, color: "inherit" }}
          >
            <X size={14} aria-hidden />
            Dismiss
          </button>
          <Link
            href={PWA_FAQ_LINKS.pushHelp}
            aria-label={copy.howTo}
            title={copy.howTo}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.8, display: "inline-flex", alignItems: "center", gap: 4, color: "inherit", textDecoration: "none" }}
          >
            <HelpCircle size={14} aria-hidden />
            {copy.howTo}
          </Link>
        </span>
      </div>
    );
  }

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
        border: `1px solid ${surface.border}`,
        background: surface.background,
        color: surface.text,
        fontSize: 13,
        marginBottom: 10,
      }}
    >
      <Bell size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: surface.icon }} />
      <span style={{ flex: 1 }}>
        {failureLine ?? copy.prompt}
        {(failure === "denied" || permission === "denied") && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.9 }}>{helpLine}</span>
        )}
      </span>
      {!failureLine || failure === "dismissed-permission" ? (
        <button
          onClick={() => void enable()}
          disabled={busy || !isOnline}
          title={!isOnline ? copy.offline : copy.enable}
          style={{
            background: "var(--color-primary, #00623B)",
            color: "var(--color-text-inverse, #FFFFFF)",
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
        <Link
          href={PWA_FAQ_LINKS.pushHelp}
          aria-label={copy.howTo}
          title={copy.howTo}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", color: "inherit", textDecoration: "none" }}
        >
          <HelpCircle size={16} aria-hidden />
        </Link>
      )}
      <button
        onClick={dismiss}
        disabled={busy}
        aria-label={copy.dismissed}
        title={copy.dismissed}
        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", color: "inherit" }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
