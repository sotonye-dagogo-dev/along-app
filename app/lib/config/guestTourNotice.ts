/**
 * Guest tour prompt — config/metadata-driven, notice-queue aware.
 *
 * Guests get a single dismissible nudge to try the platform tour. It is
 * deliberately *late and polite*: it waits for the cookie-consent bar and the
 * PWA install prompt to clear first (one notice at a time), never appears on
 * a route where the tour auto-starts (the tour opens itself there), never
 * appears while a tour is in progress/paused, and never nags a guest who
 * dismissed it within the TTL. Signed-in users are never prompted here — they
 * can replay the tour from their profile or the footer.
 *
 * The footer link remains the permanent entry point (Along column). All
 * constants live here so the component and tests share one contract.
 */

import { PWA_INSTALL_CONFIG } from "./pwa";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  isTourAutoStartRoute,
  isTourTerminal,
  readTourStateShape,
  type PlatformTourConfig,
  type PlatformTourState,
} from "./platformTour";

/** Cookie-consent accepted (dispatched by CookieConsent). */
export const COOKIE_CONSENT_EVENT = "along:cookie-consent-changed";
/** Install prompt installed/dismissed (dispatched by InstallPrompt). */
export const PWA_INSTALL_NOTICE_EVENT = "along:pwa-install-changed";

export interface GuestTourNoticeCopy {
  title: string;
  body: string;
  action: string;
  dismiss: string;
  footerHint: string;
  expandLabel: string;
}

export const GUEST_TOUR_NOTICE_CONFIG = {
  enabled: true,
  /** Wait before the first paint of the prompt (lets the page settle). */
  delayMs: 12_000,
  /** A dismissal keeps the prompt away for 14 days (mirrors install prompt). */
  dismissTtlMs: 14 * 24 * 60 * 60 * 1000,
  storageKey: "along-guest-tour-notice-dismissed-at",
  /** Cookie set by CookieConsent; we wait for it so two bottom bars never stack. */
  cookieName: "cookieConsent",
  waitForCookieConsent: true,
  waitForInstallPrompt: true,
  /** Auto-start routes already show the tour — no extra prompt there. */
  suppressOnTourAutoStartRoute: true,
  copy: {
    title: "New here? Take the guided tour",
    body: "A quick walkthrough of sharing routes, exploring the map and building a strong route score. It takes a couple of minutes.",
    action: "Start the tour",
    dismiss: "Not now",
    footerHint: "You can always take it again from the Along section in the footer.",
    expandLabel: "Take the platform tour",
  } satisfies GuestTourNoticeCopy,
  i18nKeys: {
    title: "tourNotice.title",
    body: "tourNotice.body",
    action: "tourNotice.action",
    dismiss: "tourNotice.dismiss",
    footerHint: "tourNotice.footerHint",
    expandLabel: "tourNotice.expandLabel",
  },
} as const;

export type GuestTourNoticeGateReason =
  | "eligible"
  | "disabled"
  | "not-guest"
  | "tour-unavailable"
  | "tour-terminal"
  | "tour-in-progress"
  | "auto-start-route"
  | "cookie-consent-pending"
  | "install-prompt-pending"
  | "dismissed";

export interface GuestTourNoticeGateInput {
  now: number;
  isGuest: boolean;
  noticeEnabled: boolean;
  tourConfig: Pick<PlatformTourConfig, "enabled" | "autoStart" | "autoStartRoutes" | "guest">;
  pathname: string;
  tourState: PlatformTourState | null;
  /** Timestamp of the last dismissal (0/null when never dismissed). */
  dismissedAt: number | null;
  cookieConsentGranted: boolean;
  installPromptPending: boolean;
  dismissTtlMs?: number;
}

export interface GuestTourNoticeGateResult {
  show: boolean;
  reason: GuestTourNoticeGateReason;
}

/**
 * Pure ordered gate matrix. First failing condition wins (documented order),
 * and every unknown/garbage input degrades to hidden — never a surprise nag.
 */
export function shouldShowGuestTourNotice(
  input: GuestTourNoticeGateInput,
): GuestTourNoticeGateResult {
  const config = GUEST_TOUR_NOTICE_CONFIG;
  const isGuest = input.isGuest === true;
  const noticeEnabled = input.noticeEnabled === true;
  const tourConfig = input.tourConfig ?? DEFAULT_PLATFORM_TOUR_CONFIG;

  if (!noticeEnabled) return { show: false, reason: "disabled" };
  if (!isGuest) return { show: false, reason: "not-guest" };
  if (!tourConfig.enabled || !tourConfig.guest.enabled) {
    return { show: false, reason: "tour-unavailable" };
  }
  if (isTourTerminal(input.tourState)) return { show: false, reason: "tour-terminal" };
  if (input.tourState) return { show: false, reason: "tour-in-progress" };

  if (
    config.suppressOnTourAutoStartRoute &&
    tourConfig.autoStart &&
    isTourAutoStartRoute(input.pathname, tourConfig.autoStartRoutes)
  ) {
    return { show: false, reason: "auto-start-route" };
  }
  if (config.waitForInstallPrompt && input.installPromptPending) {
    return { show: false, reason: "install-prompt-pending" };
  }
  if (config.waitForCookieConsent && !input.cookieConsentGranted) {
    return { show: false, reason: "cookie-consent-pending" };
  }

  const dismissedAt = Number(input.dismissedAt ?? 0);
  const ttl = Number.isFinite(input.dismissTtlMs) ? Math.max(0, input.dismissTtlMs as number) : config.dismissTtlMs;
  if (Number.isFinite(dismissedAt) && dismissedAt > 0 && input.now - dismissedAt < ttl) {
    return { show: false, reason: "dismissed" };
  }
  return { show: true, reason: "eligible" };
}

/** True when the stored dismissal timestamp is fresh (never throws). */
export function isGuestTourNoticeDismissed(
  storedValue: string | null | undefined,
  now: number,
  ttlMs: number = GUEST_TOUR_NOTICE_CONFIG.dismissTtlMs,
): boolean {
  const at = Number(storedValue ?? "");
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < Math.max(0, ttlMs);
}

/**
 * True while the global install prompt is still queued (not installed, not
 * dismissed inside its own TTL, not running standalone). The tour prompt waits
 * so the bottom of the screen never hosts two cards at once.
 */
export function isInstallNoticePending(input: {
  standalone: boolean;
  installed: boolean;
  dismissedAt: number | null | undefined;
  now: number;
  dismissTtlMs?: number;
}): boolean {
  if (input.standalone || input.installed) return false;
  const at = Number(input.dismissedAt ?? 0);
  const ttl = Number.isFinite(input.dismissTtlMs)
    ? Math.max(0, input.dismissTtlMs as number)
    : PWA_INSTALL_CONFIG.storage.dismissTtlMs;
  if (Number.isFinite(at) && at > 0 && input.now - at < ttl) return false;
  return true;
}

/** Parse a `document.cookie` string for the consent flag (garbage → false). */
export function hasCookieConsent(cookieString: string, cookieName: string = GUEST_TOUR_NOTICE_CONFIG.cookieName): boolean {
  if (!cookieString || !cookieName) return false;
  return cookieString
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${cookieName}=true`);
}

/** Read persisted tour progress using the configured state key (never throws). */
export function readGuestTourProgress(tourConfig: PlatformTourConfig): PlatformTourState | null {
  try {
    if (typeof window === "undefined") return null;
    return readTourStateShape(window.localStorage.getItem(tourConfig.storage.stateKey));
  } catch {
    return null;
  }
}
