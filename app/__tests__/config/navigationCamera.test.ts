/**
 * Sprint 91 — live-navigation camera policy.
 *
 * Covers the pure heading/resume helpers plus source contracts proving the
 * navigation map (and only it) wires the gesture-yield, idle auto-resume,
 * true-north release and heading-up follow.
 */
import fs from "fs";
import path from "path";
import {
  NAVIGATION_CAMERA_CONFIG,
  normalizeHeading,
  bearingDelta,
  shouldRotateToHeading,
  shouldResumeNavigationCamera,
} from "@/app/lib/config/navigationCamera";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("normalizeHeading", () => {
  it("passes through valid compass headings", () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(90)).toBe(90);
    expect(normalizeHeading(359.5)).toBe(359.5);
  });

  it("normalises out-of-range and negative headings into [0, 360)", () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(450)).toBe(90);
    expect(normalizeHeading(-90)).toBe(270);
    expect(normalizeHeading(-360)).toBe(0);
  });

  it("rejects nullish / non-finite values (stationary geolocation reports NaN)", () => {
    expect(normalizeHeading(null)).toBeNull();
    expect(normalizeHeading(undefined)).toBeNull();
    expect(normalizeHeading(Number.NaN)).toBeNull();
    expect(normalizeHeading(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeHeading("90")).toBeNull();
  });
});

describe("bearingDelta / shouldRotateToHeading", () => {
  it("measures the shortest angular distance across the 0/360 seam", () => {
    expect(bearingDelta(10, 350)).toBe(20);
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(180, 0)).toBe(180);
  });

  it("never rotates for a missing heading", () => {
    expect(shouldRotateToHeading(null, 0)).toBe(false);
  });

  it("ignores sub-threshold jitter but accepts meaningful turns", () => {
    const jitter = NAVIGATION_CAMERA_CONFIG.headingJitterDeg;
    expect(shouldRotateToHeading(1, 0)).toBe(false);
    expect(shouldRotateToHeading(jitter - 1, 0)).toBe(false);
    expect(shouldRotateToHeading(jitter, 0)).toBe(true);
    expect(shouldRotateToHeading(180, 0)).toBe(true);
  });
});

describe("shouldResumeNavigationCamera", () => {
  it("never auto-resumes a free (explicitly decentred) camera", () => {
    expect(
      shouldResumeNavigationCamera({
        mode: "free",
        interacting: false,
        lastInteractionAt: 0,
        now: 10 * NAVIGATION_CAMERA_CONFIG.idleResumeMs,
      })
    ).toBe(false);
  });

  it("waits for the idle window after the last gesture, then resumes", () => {
    const last = 10_000;
    const delay = NAVIGATION_CAMERA_CONFIG.idleResumeMs;
    const base = { mode: "centered" as const, interacting: false, lastInteractionAt: last };
    expect(shouldResumeNavigationCamera({ ...base, now: last })).toBe(false);
    expect(shouldResumeNavigationCamera({ ...base, now: last + delay - 1 })).toBe(false);
    expect(shouldResumeNavigationCamera({ ...base, now: last + delay })).toBe(true);
  });

  it("keeps deferring while a gesture is actively down", () => {
    expect(
      shouldResumeNavigationCamera({
        mode: "centered",
        interacting: true,
        lastInteractionAt: 0,
        now: 10_000_000,
      })
    ).toBe(false);
  });

  it("honours a custom idle delay", () => {
    expect(
      shouldResumeNavigationCamera({
        mode: "centered",
        interacting: false,
        lastInteractionAt: 0,
        now: 50,
        idleDelayMs: 100,
      })
    ).toBe(false);
    expect(
      shouldResumeNavigationCamera({
        mode: "centered",
        interacting: false,
        lastInteractionAt: 0,
        now: 100,
        idleDelayMs: 100,
      })
    ).toBe(true);
  });
});

describe("config sanity", () => {
  it("has a human idle window with a cheaper poll loop", () => {
    expect(NAVIGATION_CAMERA_CONFIG.idleResumeMs).toBeGreaterThanOrEqual(1_000);
    expect(NAVIGATION_CAMERA_CONFIG.pollMs).toBeGreaterThan(0);
    expect(NAVIGATION_CAMERA_CONFIG.pollMs).toBeLessThan(NAVIGATION_CAMERA_CONFIG.idleResumeMs);
  });

  it("uses design-token classes only (no hardcoded hex)", () => {
    expect(NAVIGATION_CAMERA_CONFIG.controlClass).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(NAVIGATION_CAMERA_CONFIG.controlClass).toContain("bg-bg-card");
    expect(NAVIGATION_CAMERA_CONFIG.controlClass).toContain("text-text-primary");
  });

  it("exposes both toggle labels so the button text can interchange", () => {
    expect(NAVIGATION_CAMERA_CONFIG.labels.releaseAction.length).toBeGreaterThan(0);
    expect(NAVIGATION_CAMERA_CONFIG.labels.centerAction.length).toBeGreaterThan(0);
    expect(NAVIGATION_CAMERA_CONFIG.labels.releaseAction).not.toBe(
      NAVIGATION_CAMERA_CONFIG.labels.centerAction
    );
  });
});

describe("RouteMap navigation camera contract", () => {
  const routeMap = read("app/components/features/posts/RouteMap.tsx");

  it("gates the follow camera on centered mode and the gesture pause", () => {
    expect(routeMap).toContain('cameraMode !== "centered" || cameraPaused');
  });

  it("pauses following on gesture without ending it", () => {
    expect(routeMap).toContain("pauseNavigationCamera");
    expect(routeMap).toContain('if (navigationCamera && cameraMode === "centered") setCameraPaused(true)');
  });

  it("auto-resumes through the pure idle gate", () => {
    expect(routeMap).toContain("shouldResumeNavigationCamera({");
    expect(routeMap).toContain("setCameraPaused(false)");
  });

  it("releases to true north and re-centres via the toggle", () => {
    expect(routeMap).toContain("handleCameraToggle");
    expect(routeMap).toContain("bearing: 0");
    expect(routeMap).toContain("NAVIGATION_CAMERA_CONFIG.labels.releaseAction");
    expect(routeMap).toContain("NAVIGATION_CAMERA_CONFIG.labels.centerAction");
  });

  it("keeps the user arrow aligned with the rotated map during navigation", () => {
    expect(routeMap).toContain('rotationAlignment={navigationCamera ? "map" : "viewport"}');
  });

  it("rotates only on meaningful heading changes (no jitter)", () => {
    expect(routeMap).toContain("shouldRotateToHeading(userHeading, currentBearing)");
  });
});

describe("LiveNavigationModal wires the navigation camera", () => {
  const modal = read("app/components/features/posts/LiveNavigationModal.tsx");

  it("enables the interactive follow camera on its RouteMap", () => {
    expect(modal).toContain("followUser={!!userLocation}");
    expect(modal).toContain("navigationCamera");
  });
});
