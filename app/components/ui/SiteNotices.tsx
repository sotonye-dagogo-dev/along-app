"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import {
  SITE_NOTICE_CONFIG,
  normalizeMaintenanceFlag,
  normalizeAnnouncementText,
} from "@/app/lib/config/siteNotice";

type NoticeState = {
  maintenanceMode: boolean;
  announcementBanner: string;
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

/**
 * Platform notice strips — the runtime consumer of the admin
 * `maintenanceMode` + `announcementBanner` configs.
 *
 * Fetches `/api/site-config` on mount, on an interval, and on
 * online/focus, so a toggle from the admin board lands without a reload.
 * Never throws; offline keeps the last-known strips (SW may serve the
 * cached response). Maintenance is non-dismissible (only the admin can
 * end it); the announcement is session-dismissible per device.
 */
export function SiteNotices() {
  const auth = useContext(AuthContext);
  const { tf } = useTranslation();
  const [notices, setNotices] = useState<NoticeState>({
    maintenanceMode: false,
    announcementBanner: "",
  });
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
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
        announcementBanner: normalizeAnnouncementText(record.announcementBanner),
      });
    } catch {
      /* offline / transient — keep last-known strips */
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      setAnnouncementDismissed(
        readSessionFlag(SITE_NOTICE_CONFIG.announcement.dismissStorageKey),
      );
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
  }, [load]);

  const dismissAnnouncement = useCallback(() => {
    setAnnouncementDismissed(true);
    writeSessionFlag(SITE_NOTICE_CONFIG.announcement.dismissStorageKey);
  }, []);

  const isAdmin = auth?.user?.role === "ADMIN";
  const announcementVisible =
    !announcementDismissed && notices.announcementBanner.length > 0;
  const maintenanceVisible = notices.maintenanceMode;

  const copy = useMemo(() => {
    const { i18nKeys, copy: fallback } = SITE_NOTICE_CONFIG;
    return {
      maintenanceTitle: tf(i18nKeys.maintenanceTitle, fallback.maintenance.title),
      maintenanceBody: tf(i18nKeys.maintenanceBody, fallback.maintenance.body),
      maintenanceAdminNote: tf(
        i18nKeys.maintenanceAdminNote,
        fallback.maintenance.adminNote,
      ),
      announcementLabel: tf(i18nKeys.announcementLabel, fallback.announcementLabel),
      dismiss: tf(i18nKeys.dismiss, fallback.dismiss),
    };
  }, [tf]);

  if (!maintenanceVisible && !announcementVisible) return null;

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
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 16px",
            background: SITE_NOTICE_CONFIG.tokens.maintenance.background,
            border: SITE_NOTICE_CONFIG.tokens.maintenance.border,
            color: SITE_NOTICE_CONFIG.tokens.maintenance.color,
            fontSize: 14,
            lineHeight: 1.45,
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
      {announcementVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 16px",
            background: SITE_NOTICE_CONFIG.tokens.announcement.background,
            border: SITE_NOTICE_CONFIG.tokens.announcement.border,
            borderTop: "none",
            color: SITE_NOTICE_CONFIG.tokens.announcement.color,
            fontSize: 13,
            lineHeight: 1.45,
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
          <button
            type="button"
            onClick={dismissAnnouncement}
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
        </div>
      )}
    </div>
  );
}
