/**
 * Guest tour prompt — serialized-notice gate matrix + wiring contract.
 */
import fs from "fs";
import path from "path";
import {
  GUEST_TOUR_NOTICE_CONFIG,
  hasCookieConsent,
  isGuestTourNoticeDismissed,
  isInstallNoticePending,
  shouldShowGuestTourNotice,
  type GuestTourNoticeGateInput,
} from "@/app/lib/config/guestTourNotice";
import { DEFAULT_PLATFORM_TOUR_CONFIG } from "@/app/lib/config/platformTour";
import { FOOTER_CONFIG } from "@/app/lib/config/footer";

const NOW = 1_000_000_000_000;

function input(overrides: Partial<GuestTourNoticeGateInput> = {}): GuestTourNoticeGateInput {
  return {
    now: NOW,
    isGuest: true,
    noticeEnabled: true,
    tourConfig: DEFAULT_PLATFORM_TOUR_CONFIG,
    pathname: "/explore",
    tourState: null,
    dismissedAt: null,
    cookieConsentGranted: true,
    installPromptPending: false,
    ...overrides,
  };
}

describe("guest tour prompt gate", () => {
  it("shows only to eligible guests", () => {
    expect(shouldShowGuestTourNotice(input())).toEqual({ show: true, reason: "eligible" });
    expect(shouldShowGuestTourNotice(input({ isGuest: false })).reason).toBe("not-guest");
    expect(shouldShowGuestTourNotice(input({ noticeEnabled: false })).reason).toBe("disabled");
  });

  it("never competes with tour start, progress, or terminal states", () => {
    expect(
      shouldShowGuestTourNotice(
        input({
          tourConfig: { ...DEFAULT_PLATFORM_TOUR_CONFIG, guest: { enabled: false } },
        }),
      ).reason,
    ).toBe("tour-unavailable");
    expect(
      shouldShowGuestTourNotice(input({ pathname: "/home" })).reason,
    ).toBe("auto-start-route");
    expect(
      shouldShowGuestTourNotice(
        input({
          tourState: { version: 1, startedAt: NOW - 5000, stepIndex: 0 },
        }),
      ).reason,
    ).toBe("tour-in-progress");
    expect(
      shouldShowGuestTourNotice(
        input({
          tourState: { version: 1, startedAt: NOW - 5000, stepIndex: 0, completedAt: NOW - 1000 },
        }),
      ).reason,
    ).toBe("tour-terminal");
  });

  it("serializes behind cookie consent and the install prompt", () => {
    expect(shouldShowGuestTourNotice(input({ cookieConsentGranted: false })).reason).toBe(
      "cookie-consent-pending",
    );
    expect(shouldShowGuestTourNotice(input({ installPromptPending: true })).reason).toBe(
      "install-prompt-pending",
    );
    // Cookie consent wins first so the two bottom bars can never stack.
    expect(
      shouldShowGuestTourNotice(
        input({ cookieConsentGranted: false, installPromptPending: true }),
      ).reason,
    ).toBe("install-prompt-pending");
  });

  it("respects the dismissal TTL and tolerates garbage", () => {
    expect(shouldShowGuestTourNotice(input({ dismissedAt: NOW - 1000 })).reason).toBe("dismissed");
    expect(
      shouldShowGuestTourNotice(input({ dismissedAt: NOW - GUEST_TOUR_NOTICE_CONFIG.dismissTtlMs - 1 }))
        .show,
    ).toBe(true);
    expect(isGuestTourNoticeDismissed("not-a-number", NOW)).toBe(false);
    expect(isGuestTourNoticeDismissed("0", NOW)).toBe(false);
    expect(isGuestTourNoticeDismissed(String(NOW - 5), NOW)).toBe(true);
  });

  it("detects the install prompt and cookie with safe parsing", () => {
    expect(
      isInstallNoticePending({ standalone: false, installed: false, dismissedAt: null, now: NOW }),
    ).toBe(true);
    expect(
      isInstallNoticePending({ standalone: true, installed: false, dismissedAt: null, now: NOW }),
    ).toBe(false);
    expect(
      isInstallNoticePending({
        standalone: false,
        installed: false,
        dismissedAt: NOW - 1000,
        now: NOW,
      }),
    ).toBe(false);
    expect(hasCookieConsent("cookieConsent=true; theme=dark")).toBe(true);
    expect(hasCookieConsent("theme=dark")).toBe(false);
    expect(hasCookieConsent("")).toBe(false);
  });
});

describe("guest tour prompt wiring", () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("mounts beside the tour in the root layout only", () => {
    expect(read("app/layout.tsx")).toContain("GuestTourNotice");
    expect(read("app/(dashboard)/layout.tsx")).not.toContain("GuestTourNotice");
  });

  it("keeps the tour link in the Along footer column", () => {
    const along = FOOTER_CONFIG.columns.find((column) => column.i18nKey === "footer.company");
    const community = FOOTER_CONFIG.columns.find((column) => column.i18nKey === "footer.community");
    expect(along?.links.some((link) => link.i18nKey === "tour.takeTour")).toBe(true);
    expect(community?.links.some((link) => link.i18nKey === "tour.takeTour")).toBe(false);
  });

  it("wires the hand-off events both ways", () => {
    expect(read("app/components/features/tour/PlatformTour.tsx")).toContain("advanceEvent");
    expect(read("app/components/features/tour/PlatformTour.tsx")).toContain("scrollIntoView");
    expect(read("app/(dashboard)/home/page.tsx")).toContain("SHARE_ROUTE_OPEN_EVENT");
    expect(read("app/components/features/posts/ShareRouteModal.tsx")).toContain("SHARE_ROUTE_TAB_EVENT");
    expect(read("app/components/ui/CookieConsent.tsx")).toContain("COOKIE_CONSENT_EVENT");
    expect(read("app/components/pwa/InstallPrompt.tsx")).toContain("PWA_INSTALL_NOTICE_EVENT");
  });
});
