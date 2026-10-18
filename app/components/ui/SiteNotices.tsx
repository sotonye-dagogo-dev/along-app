"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, RefreshCw, X } from "lucide-react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import {
  SITE_NOTICE_CONFIG,
  normalizeMaintenanceFlag,
  normalizeAnnouncementText,
  normalizeAnnouncements,
  type NormalizedAnnouncement,
} from "@/app/lib/config/siteNotice";
import { safeClientRefresh } from "@/app/lib/pwa/safeClientRefresh";

type NoticeState = {
  maintenanceMode: boolean;
  refreshNotice: boolean;
  announcementBanner: string;
  announcements: NormalizedAnnouncement[];
};

const EMPTY_NOTICES: NoticeState = {
  maintenanceMode: false,
  refreshNotice: false,
  announcementBanner: "",
  announcements: [],
};

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* private-mode safe — notice simply stays dismissible next load */
  }
}

function readSessionFlags(keys: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of keys) out[key] = readSessionFlag(key);
  return out;
}

/**
 * Platform notice strips — the runtime consumer of the admin
 * `maintenanceMode`, `refreshNotice`, `announcementBanner`, and
 * `announcements` configs.
 *
 * Fetches `/api/site-config` on mount, on an interval, and on
 * online/focus, so a toggle from the admin board lands without a reload.
 * Never throws; offline keeps the last-known strips (SW may serve the
 * cached response). Maintenance is non-dismissible (only the admin can
 * end it); the refresh strip is admin-controlled with a one-tap safe
 * refresh (keeps session + drafts, reboots the SW); announcements —
 * legacy text + rich entries with optional CTA — are session-dismissible
 * per item.
 */
export function SiteNotices() {
  const auth = useContext(AuthContext);
  const { tf } = useTranslation();
  const [notices, setNotices] = useState<NoticeState>(EMPTY_NOTICES);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetch(SITE_NOTICE_CONFIG.endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data: unknown = await res.json();
      const record =
        data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      setNotices({
        maintenanceMode: normalizeMaintenanceFlag(record.maintenanceMode),
        refreshNotice: normalizeMaintenanceFlag(record.refreshNotice),
        announcementBanner: normalizeAnnouncementText(record.announcementBanner),
        announcements: normalizeAnnouncements(record.announcements),
      });
    } catch {
      /* offline / transient — keep last-known strips */
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Every dismissible item key (legacy banner + per-id rich entries).
  const dismissKeys = useMemo(() => {
    const keys = [
      SITE_NOTICE_CONFIG.announcement.dismissStorageKey,
      ...notices.announcements.map((a) =>
        `${SITE_NOTICE_CONFIG.announcement.dismissIdPrefix}${a.id}`,
      ),
    ];
    return keys;
  }, [notices.announcements]);

  useEffect(() => {
    void load();
    try {
      setDismissed(readSessionFlags(dismissKeys));
    } catch {
      /* ignore */
    }
    const { intervalMs, onFocus, onOnline } = SITE_NOTICE_CONFIG.refresh;
    const timer = setInterval(() => void load(), intervalMs);
    const onFocusHandler = onFocus ? () => void load() : null;
    const onOnlineHandler = onOnline ? () => void load() : null;
    try {
      if (onFocusHandler) window.addEventListener("focus", onFocusHandler);
      if (onOnlineHandler) window.addEventListener("online", onOnlineHandler);
    } catch {
      /* non-critical */
    }
    return () => {
      clearInterval(timer);
      try {
        if (onFocusHandler) window.removeEventListener("focus", onFocusHandler);
        if (onOnlineHandler) window.removeEventListener("online", onOnlineHandler);
      } catch {
        /* ignore */
      }
    };
    // dismissKeys intentionally omitted — polling should not rebind listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Pick up dismissals for newly-arrived announcement ids without wiping
  // the current map (sessionStorage is the source of truth).
  useEffect(() => {
    try {
      setDismissed((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const key of dismissKeys) {
          if (!(key in next)) {
            next[key] = readSessionFlag(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch {
      /* ignore */
    }
  }, [dismissKeys]);

  const dismissItem = useCallback((key: string) => {
    setDismissed((prev) => ({ ...prev, [key]: true }));
    writeSessionFlag(key);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    // safeClientRefresh navigates away; on failure paths it still reloads.
    await safeClientRefresh();
    // If navigation was blocked, re-enable after the util's in-flight window.
    setTimeout(() => setRefreshing(false), 2_500);
  }, [refreshing]);

  const isAdmin = auth?.user?.role === "ADMIN";
  const legacyDismissKey = SITE_NOTICE_CONFIG.announcement.dismissStorageKey;
  const legacyVisible =
    !dismissed[legacyDismissKey] && notices.announcementBanner.length > 0;
  const richVisible = notices.announcements.filter(
    (a) => !dismissed[`${SITE_NOTICE_CONFIG.announcement.dismissIdPrefix}${a.id}`],
  );
  const maintenanceVisible = notices.maintenanceMode;
  const refreshVisible = notices.refreshNotice;

  const copy = useMemo(() => {
    const { i18nKeys, copy: fallback } = SITE_NOTICE_CONFIG;
    return {
      maintenanceTitle: tf(i18nKeys.maintenanceTitle, fallback.maintenance.title),
      maintenanceBody: tf(i18nKeys.maintenanceBody, fallback.maintenance.body),
      maintenanceAdminNote: tf(
        i18nKeys.maintenanceAdminNote,
        fallback.maintenance.adminNote,
      ),
      refreshTitle: tf(i18nKeys.refreshTitle, fallback.refresh.title),
      refreshBody: tf(i18nKeys.refreshBody, fallback.refresh.body),
      refreshAction: tf(i18nKeys.refreshAction, fallback.refresh.action),
      refreshPending: tf(i18nKeys.refreshPending, fallback.refresh.pending),
      announcementLabel: tf(i18nKeys.announcementLabel, fallback.announcementLabel),
      dismiss: tf(i18nKeys.dismiss, fallback.dismiss),
    };
  }, [tf]);

  const hasAnyVisible =
    maintenanceVisible ||
    refreshVisible ||
    legacyVisible ||
    richVisible.length > 0;
  if (!hasAnyVisible) return null;

  const { tokens } = SITE_NOTICE_CONFIG;

  const dismissButton = (key: string) => (
    <button
      type="button"
      onClick={() => dismissItem(key)}
      aria-label={copy.dismiss}
      title={copy.dismiss}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "inherit",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        opacity: 0.75,
        padding: 2,
      }}
    >
      <X size={16} aria-hidden />
    </button>
  );

  const stripBase: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    lineHeight: 1.45,
  };

  // Top-of-flow strips (mounted before page content in the root layout) —
  // sticky so they stay visible while scrolling.
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 70,
      }}
    >
      {maintenanceVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...stripBase,
            padding: "10px 16px",
            fontSize: 14,
            background: tokens.maintenance.background,
            border: tokens.maintenance.border,
            color: tokens.maintenance.color,
          }}
        >
          <AlertTriangle size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 700 }}>
              {copy.maintenanceTitle}
            </span>
            <span style={{ display: "block", marginTop: 2 }}>
              {copy.maintenanceBody}
            </span>
            {isAdmin && (
              <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                {copy.maintenanceAdminNote}
              </span>
            )}
          </span>
        </div>
      )}
      {refreshVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...stripBase,
            alignItems: "center",
            padding: "8px 16px",
            background: tokens.refresh.background,
            border: tokens.refresh.border,
            borderTop: maintenanceVisible ? "none" : tokens.refresh.border,
            color: tokens.refresh.color,
          }}
        >
          <RefreshCw
            size={16}
            aria-hidden
            style={{ flexShrink: 0, marginTop: 2, color: "var(--color-primary, #00A862)" }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 700 }}>{copy.refreshTitle}</span>
            <span style={{ display: "block", marginTop: 2 }}>{copy.refreshBody}</span>
          </span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.7 : 1,
              background: tokens.refresh.actionBackground,
              color: tokens.refresh.actionColor,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            <RefreshCw size={13} aria-hidden style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
            {refreshing ? copy.refreshPending : copy.refreshAction}
          </button>
        </div>
      )}
      {richVisible.map((item, index) => {
        const dismissKey = `${SITE_NOTICE_CONFIG.announcement.dismissIdPrefix}${item.id}`;
        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            style={{
              ...stripBase,
              padding: "8px 16px",
              background: tokens.announcement.background,
              border: tokens.announcement.border,
              borderTop:
                maintenanceVisible || refreshVisible || index > 0
                  ? "none"
                  : tokens.announcement.border,
              color: tokens.announcement.color,
            }}
          >
            <Info size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, opacity: 0.8 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 12, opacity: 0.75 }}>
                {copy.announcementLabel}
              </span>
              <span style={{ display: "block", marginTop: 2 }}>{item.body}</span>
              {item.ctaHref && item.ctaLabel && (
                <a
                  href={item.ctaHref}
                  {...(item.ctaHref.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    marginTop: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: tokens.announcement.ctaBackground,
                    color: tokens.announcement.ctaColor,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {item.ctaLabel}
                </a>
              )}
            </span>
            {dismissButton(dismissKey)}
          </div>
        );
      })}
      {legacyVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...stripBase,
            padding: "8px 16px",
            background: tokens.announcement.background,
            border: tokens.announcement.border,
            borderTop:
              maintenanceVisible || refreshVisible || richVisible.length > 0
                ? "none"
                : tokens.announcement.border,
            color: tokens.announcement.color,
          }}
        >
          <Info size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, opacity: 0.8 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: 12, opacity: 0.75 }}>
              {copy.announcementLabel}
            </span>
            <span style={{ display: "block", marginTop: 2 }}>
              {notices.announcementBanner}
            </span>
          </span>
          {dismissButton(legacyDismissKey)}
        </div>
      )}
    </div>
  );
}
