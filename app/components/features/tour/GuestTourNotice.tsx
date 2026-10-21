"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Compass, X } from "lucide-react";
import { AppButton } from "@/app/components/ui/AppButton";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import { PWA_INSTALL_CONFIG, isStandaloneDisplay } from "@/app/lib/config/pwa";
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  TOUR_START_EVENT,
  normalizePlatformTourConfig,
  type PlatformTourConfig,
} from "@/app/lib/config/platformTour";
import {
  COOKIE_CONSENT_EVENT,
  GUEST_TOUR_NOTICE_CONFIG,
  PWA_INSTALL_NOTICE_EVENT,
  hasCookieConsent,
  isInstallNoticePending,
  readGuestTourProgress,
  shouldShowGuestTourNotice,
} from "@/app/lib/config/guestTourNotice";

const CONFIG_ENDPOINT = "/api/tour";

function readNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * One serialized, dismissible guest prompt for the platform tour.
 *
 * @deprecated Not mounted by default (see GUEST_TOUR_NOTICE_CONFIG.enabled).
 * Guests now use the permanent "Take tour" CTA in the guest banner; the
 * footer/profile/FAQ entry points remain. Re-mount explicitly to restore the
 * old prompt — it still only asks guests, and only after the cookie bar is
 * accepted and the install prompt is out of the way.
 */
export default function GuestTourNotice() {
  const pathname = usePathname();
  const { isGuest, isLoading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { tf } = useTranslation();
  const [tourConfig, setTourConfig] = useState<PlatformTourConfig>(DEFAULT_PLATFORM_TOUR_CONFIG);
  const [eligible, setEligible] = useState(false);
  const evaluatedRef = useRef(false);

  // Non-blocking config sync: admin enable/guest toggles are respected when
  // reachable; bundled defaults keep the prompt logical offline.
  useEffect(() => {
    let cancelled = false;
    fetch(CONFIG_ENDPOINT)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const tour = (data as { tour?: unknown } | null)?.tour;
        if (tour) setTourConfig(normalizePlatformTourConfig(tour, DEFAULT_PLATFORM_TOUR_CONFIG));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluate = useCallback(() => {
    if (isLoading || typeof window === "undefined") return false;
    const now = Date.now();
    const standalone = isStandaloneDisplay();
    const installed = readFlag(PWA_INSTALL_CONFIG.storage.installedKey);
    const installDismissedAt = readNumber(PWA_INSTALL_CONFIG.storage.dismissedAtKey);
    const installPromptPending = isInstallNoticePending({
      standalone,
      installed,
      dismissedAt: installDismissedAt,
      now,
    });
    let cookieConsentGranted = false;
    try {
      cookieConsentGranted = hasCookieConsent(document.cookie);
    } catch {
      cookieConsentGranted = false;
    }
    const result = shouldShowGuestTourNotice({
      now,
      isGuest,
      noticeEnabled: GUEST_TOUR_NOTICE_CONFIG.enabled,
      tourConfig,
      pathname: pathname ?? "",
      tourState: readGuestTourProgress(tourConfig),
      dismissedAt: readNumber(GUEST_TOUR_NOTICE_CONFIG.storageKey),
      cookieConsentGranted,
      installPromptPending,
    });
    setEligible(result.show);
    return result.show;
  }, [isGuest, isLoading, pathname, tourConfig]);

  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  // First evaluation is delayed so the page (and its other notices) settle.
  useEffect(() => {
    if (isLoading) return;
    if (!isGuest) {
      setEligible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      evaluatedRef.current = true;
      evaluateRef.current();
    }, Math.max(GUEST_TOUR_NOTICE_CONFIG.delayMs, 0));
    return () => window.clearTimeout(timer);
  }, [isGuest, isLoading]);

  // Re-evaluate when another notice clears (cookie/install), when the user
  // navigates, or when this tab regains focus. Hidden until the first timer.
  useEffect(() => {
    const onChange = () => {
      if (evaluatedRef.current) evaluateRef.current();
    };
    const onTourStart = () => setEligible(false);
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    window.addEventListener(PWA_INSTALL_NOTICE_EVENT, onChange);
    window.addEventListener(TOUR_START_EVENT, onTourStart);
    window.addEventListener("focus", onChange);
    window.addEventListener("storage", onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
      window.removeEventListener(PWA_INSTALL_NOTICE_EVENT, onChange);
      window.removeEventListener(TOUR_START_EVENT, onTourStart);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("storage", onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, []);

  // Late-resolving tour config / navigation should not leave a stale prompt.
  useEffect(() => {
    if (evaluatedRef.current) evaluateRef.current();
  }, [pathname, tourConfig]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(GUEST_TOUR_NOTICE_CONFIG.storageKey, String(Date.now()));
    } catch {
      // Storage blocked — close for this session anyway.
    }
    setEligible(false);
  }, []);

  const start = useCallback(() => {
    setEligible(false);
    try {
      window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
    } catch {
      // No window — nothing to start.
    }
  }, []);

  if (!eligible || !isGuest) return null;

  const copy = GUEST_TOUR_NOTICE_CONFIG.copy;
  const keys = GUEST_TOUR_NOTICE_CONFIG.i18nKeys;
  const lane = laneBottom(
    isOnline
      ? FLOATING_UI_CONFIG.lanes.guestTourNoticeBottomPx
      : FLOATING_UI_CONFIG.lanes.guestTourNoticeOfflineBottomPx,
  );

  return (
    <div
      role="note"
      aria-live="polite"
      className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm bg-bg-card border border-border shadow-md p-4 z-[55]"
      style={{ bottom: lane, borderRadius: "var(--radius-lg, 12px)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
            <Compass size={14} className="text-primary" aria-hidden />
            {tf(keys.title, copy.title)}
          </h3>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            {tf(keys.body, copy.body)}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tf(keys.dismiss, copy.dismiss)}
          className="text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary rounded-circle p-1 shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
        {tf(keys.footerHint, copy.footerHint)}
      </p>

      <div className="flex items-center justify-between gap-2 mt-3">
        <AppButton variant="ghost" size="sm" onClick={dismiss}>
          {tf(keys.dismiss, copy.dismiss)}
        </AppButton>
        <AppButton variant="primary" size="sm" onClick={start} icon={<Compass size={14} aria-hidden />}>
          {tf(keys.action, copy.action)}
        </AppButton>
      </div>
    </div>
  );
}
