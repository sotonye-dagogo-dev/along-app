/**
 * Post-card detail navigation + response-banner dismissal (execute-feature):
 * route/description text links to the detail view (tags + maps keep their own
 * actions), the share-route response banner carries a config-driven dismiss
 * label, and vehicle flags use the darkened (-900) light-theme label grade
 * for badge/app-surface contrast. Config/metadata-driven: UIs read these,
 * so assertions pin the contract, not each consumer.
 */
import { POST_ACTIONS_CONFIG } from "@/app/lib/config/postActions";
import { SHARE_ROUTE_MODAL_CONFIG } from "@/app/lib/config/shareRoute";
import { VEHICLE_REGISTRY } from "@/app/lib/config/vehicles";

describe("post-card detail navigation config", () => {
  it("enables text-to-detail links with a stable post path", () => {
    expect(POST_ACTIONS_CONFIG.detailTextLinksEnabled).toBe(true);
    expect(POST_ACTIONS_CONFIG.postPath("abc123")).toBe("/posts/abc123");
    // Encoded so ids with special chars never break the href.
    expect(POST_ACTIONS_CONFIG.postPath("a/b")).toContain("a%2Fb");
  });

  it("ships token classes that read as links without layout shift", () => {
    expect(POST_ACTIONS_CONFIG.detailDescriptionClass).toMatch("hover:underline");
    expect(POST_ACTIONS_CONFIG.detailDescriptionClass).toMatch("cursor-pointer");
    expect(POST_ACTIONS_CONFIG.detailDescriptionClass).toMatch("line-clamp-3");
    expect(POST_ACTIONS_CONFIG.detailRouteStepClass).toMatch("hover:underline");
    expect(POST_ACTIONS_CONFIG.detailRouteStepClass).toMatch("cursor-pointer");
  });
});

describe("share-route response banner dismissal config", () => {
  it("provides an accessible dismiss label + tooltip title", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.responseBannerDismissLabel.length).toBeGreaterThan(0);
    expect(SHARE_ROUTE_MODAL_CONFIG.responseBannerDismissTitle.length).toBeGreaterThan(0);
  });
});

describe("vehicle flag light-theme contrast grade", () => {
  it("uses the darkened -900 label grade on every flag", () => {
    for (const entry of Object.values(VEHICLE_REGISTRY)) {
      expect(entry.textClass).toMatch(/text-\S+-900/);
    }
  });
});
