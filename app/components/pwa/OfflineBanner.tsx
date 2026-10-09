"use client";

import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { PWA_TOAST_COPY } from "@/app/lib/config/pwa";

/**
 * Slim offline banner — renders nothing when online. Config-driven copy,
 * design-system tokens via CSS variables, no layout shift (fixed bottom).
 */
export function OfflineBanner() {
  const { isOnline, recheck } = useOnlineStatus();
  if (isOnline) return null;
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
      <span style={{ flex: 1 }}>{PWA_TOAST_COPY.wentOffline}</span>
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
        Retry
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
  if (isOnline) return null;
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
      {PWA_TOAST_COPY.cachedNotice}
    </div>
  );
}
