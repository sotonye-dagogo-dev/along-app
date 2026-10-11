import { ENDLESS_CAROUSEL_CONFIG } from "@/app/lib/config/carousel";
import { SHARE_ROUTE_MODAL_CONFIG } from "@/app/lib/config/shareRoute";
import { REQUEST_ROUTE_TRIGGER_CONFIG } from "@/app/lib/config/routeRequest";
import { FOOTER_CONFIG } from "@/app/lib/config/footer";

describe("execute-feature: carousel/share-modal/request-trigger/footer configs", () => {
  it("carousel owns its overflow and loops seamlessly", () => {
    expect(ENDLESS_CAROUSEL_CONFIG.defaultDurationSec).toBeGreaterThan(0);
    expect(ENDLESS_CAROUSEL_CONFIG.mobileDurationSec).toBeGreaterThan(0);
    expect(ENDLESS_CAROUSEL_CONFIG.wrapperClass).toMatch("overflow-hidden");
    expect(ENDLESS_CAROUSEL_CONFIG.wrapperClass).toMatch("min-w-0");
    expect(ENDLESS_CAROUSEL_CONFIG.viewportClass).toMatch("overflow-x-auto");
    expect(ENDLESS_CAROUSEL_CONFIG.resumeDelayMs).toBeGreaterThan(0);
  });

  it("carousel never uses mock fallback in production", () => {
    expect(ENDLESS_CAROUSEL_CONFIG.allowMockFallback).toBe(false);
  });

  it("share modal collapses preview + score by default and keeps form open", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.previewDefaultOpen).toBe(false);
    expect(SHARE_ROUTE_MODAL_CONFIG.scoreDefaultOpen).toBe(false);
    expect(SHARE_ROUTE_MODAL_CONFIG.formDefaultOpen).toBe(true);
    expect(SHARE_ROUTE_MODAL_CONFIG.previewTitle.length).toBeGreaterThan(0);
    expect(SHARE_ROUTE_MODAL_CONFIG.formTitle.length).toBeGreaterThan(0);
  });

  it("share modal photo-remove button is always visible and accessible (never hover-only)", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.photoRemoveLabel.length).toBeGreaterThan(0);
    const btnClass = SHARE_ROUTE_MODAL_CONFIG.photoRemoveButtonClass;
    expect(btnClass).toMatch("opacity-100");
    expect(btnClass).not.toMatch("opacity-0");
    expect(btnClass).not.toMatch("group-hover:opacity-100");
    // Touch-sized target + visible ring/border + keyboard focus treatment.
    expect(btnClass).toMatch("w-7");
    expect(btnClass).toMatch("border");
    expect(btnClass).toMatch("focus-visible:");
    // Above the thumbnail (not buried under the image) with a halo ring so
    // the control reads on any photo, light or dark.
    expect(btnClass).toMatch("z-10");
    expect(btnClass).toMatch("ring-");
    expect(SHARE_ROUTE_MODAL_CONFIG.photoRemoveIconSize).toBeGreaterThanOrEqual(14);
  });
  it("share modal exposes the Request? trigger (config-driven)", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.showRequestTrigger).toBe(true);
  });

  it("request trigger carries the Request? tagline for tooltip + a11y", () => {
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.tagline).toBe("Request?");
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.ariaLabel.length).toBeGreaterThan(0);
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.icon).toBeDefined();
  });

  it("footer grid stays 3 columns on mobile and larger screens", () => {
    expect(FOOTER_CONFIG.layout.gridClass).toMatch("grid-cols-3");
    expect(FOOTER_CONFIG.layout.gridClass).not.toMatch("grid-cols-1");
    expect(FOOTER_CONFIG.layout.linkListClass.length).toBeGreaterThan(0);
  });
});
