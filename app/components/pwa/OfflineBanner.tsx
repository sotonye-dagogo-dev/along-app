"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import { PWA_TOAST_COPY, PWA_OFFLINE_BANNER } from "@/app/lib/config/pwa";

/**
 * Slim offline banner — renders nothing when online. Collapsible so it never
 * blocks interaction: collapsed it shrinks to a corner pill that can be
 * re-expanded while still offline. Collapse state persists per device.
 * Copy is config-driven with i18n pidgin variants.
 */
export function OfflineBanner() {
  const { isOnline, recheck } = useOnlineStatus();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<boolean>(PWA_OFFLINE_BANNER.defaultCollapsed);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(PWA_OFFLINE_BANNER.storageKey) === "1");
    } catch {
      // ignore
    }
  }, []);

  // Reset to expanded on every fresh offline episode so the user notices.
  useEffect(() => {
    if (!isOnline) {
      try {
        setCollapsed(localStorage.getItem(PWA_OFFLINE_BANNER.storageKey) === "1");
      } catch {
        // ignore
      }
    }
  }, [isOnline]);

  if (isOnline) return null;

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(PWA_OFFLINE_BANNER.storageKey, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const wentOffline = t("pwa.offlineBanner") === "pwa.offlineBanner" ? PWA_TOAST_COPY.wentOffline : t("pwa.offlineBanner");
  const retryLabel = t("pwa.retry") === "pwa.retry" ? PWA_TOAST_COPY.retry : t("pwa.retry");
  const collapseLabel = t("pwa.collapse") === "pwa.collapse" ? PWA_TOAST_COPY.collapse : t("pwa.collapse");
  const expandLabel = t("pwa.expand") === "pwa.expand" ? PWA_TOAST_COPY.expand : t("pwa.expand");
  const collapsedLabel = t("pwa.collapsedLabel") === "pwa.collapsedLabel" ? PWA_TOAST_COPY.collapsedLabel : t("pwa.collapsedLabel");

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggleCollapsed(false)}
        aria-expanded={false}
        aria-label={expandLabel}
        title={expandLabel}
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 60,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 999,
          border: "none",
          background: "var(--offline-bg, #1f2937)",
          color: "var(--offline-fg, #fff)",
          boxShadow: "0 8px 28px rgba(0,0,0,.25)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <span aria-hidden>📡</span>
        {collapsedLabel}
        <ChevronUp size={14} aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        background: "var(--offline-bg, #1f2937)",
        color: "var(--offline-fg, #fff)",
        boxShadow: "0 8px 28px rgba(0,0,0,.25)",
        fontSize: 14,
      }}
    >
      <span aria-hidden>📡</span>
      <span style={{ flex: 1 }}>{wentOffline}</span>
      <button
        onClick={() => void recheck()}
        style={{
          background: "var(--brand, #00623B)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {retryLabel}
      </button>
      <button
        type="button"
        onClick={() => toggleCollapsed(true)}
        aria-expanded={true}
        aria-label={collapseLabel}
        title={collapseLabel}
        style={{
          background: "transparent",
          color: "inherit",
          border: "1px solid currentColor",
          borderRadius: 8,
          padding: "6px 8px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Cached-data notice for list/feed surfaces while offline. Sanitized,
 * informational — tells users data may be stale and to refresh when online.
 */
export function CachedDataNotice({ compact = false }: { compact?: boolean }) {
  const { isOnline } = useOnlineStatus();
  const { t } = useTranslation();
  if (isOnline) return null;
  const copy = t("pwa.cachedNotice") === "pwa.cachedNotice" ? PWA_TOAST_COPY.cachedNotice : t("pwa.cachedNotice");
  return (
    <div
      role="note"
      style={{
        padding: compact ? "6px 10px" : "8px 12px",
        borderRadius: 8,
        background: "var(--warning-soft, #fef3c7)",
        color: "var(--warning-ink, #92400e)",
        fontSize: 13,
        marginBottom: compact ? 6 : 10,
      }}
    >
      {copy}
    </div>
  );
}
