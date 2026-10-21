/**
 * Share-route composer tabs (execute-feature): the modal renders one shared
 * workspace (Details / Map / Score / Drafts) with short config-driven labels,
 * icons and a live Drafts count badge. The footer keeps only Save Draft +
 * Share, and the Details nudge links straight to Map and Score. Tests pin the
 * config contract plus the wiring (source-level) so the UI cannot drift back
 * to cramped collapsible columns unnoticed.
 */
import fs from "fs";
import path from "path";
import {
  SHARE_ROUTE_MODAL_CONFIG,
  resolveShareRouteTabId,
  type ShareRouteTabIcon,
} from "@/app/lib/config/shareRoute";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";

const TAB_IDS = ["details", "map", "score", "drafts"];
const TAB_ICONS: ShareRouteTabIcon[] = ["details", "map", "score", "drafts"];

describe("share-route tab metadata", () => {
  it("exposes the four sections in a stable order with unique ids", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.tabs.map((tab) => tab.id)).toEqual(TAB_IDS);
    expect(new Set(SHARE_ROUTE_MODAL_CONFIG.tabs.map((tab) => tab.id)).size).toBe(TAB_IDS.length);
  });

  it("uses short labels, valid icon keys and accessible names", () => {
    for (const tab of SHARE_ROUTE_MODAL_CONFIG.tabs) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.label.length).toBeLessThanOrEqual(12);
      expect(TAB_ICONS).toContain(tab.icon);
      expect(tab.ariaLabel.length).toBeGreaterThan(0);
    }
  });

  it("defaults to Details and counts drafts with a badge", () => {
    expect(SHARE_ROUTE_MODAL_CONFIG.defaultTab).toBe("details");
    const drafts = SHARE_ROUTE_MODAL_CONFIG.tabs.find((tab) => tab.id === "drafts");
    expect(drafts?.badge).toBe("drafts");
    expect(SHARE_ROUTE_MODAL_CONFIG.tabs.filter((tab) => tab.badge).length).toBe(1);
  });

  it("keeps the pre-share hint structured for real map/score links", () => {
    const hint = SHARE_ROUTE_MODAL_CONFIG.detailsHint;
    expect(hint.text).toMatch(/check/i);
    expect(hint.mapLabel.length).toBeGreaterThan(0);
    expect(hint.scoreLabel.length).toBeGreaterThan(0);
    expect(hint.conjunction.length).toBeGreaterThan(0);
    expect(hint.ariaLabel.length).toBeGreaterThan(0);
    expect(SHARE_ROUTE_MODAL_CONFIG.mapPanelHeight).toBeGreaterThanOrEqual(240);
  });
});

describe("resolveShareRouteTabId fallbacks", () => {
  it("returns configured ids unchanged", () => {
    for (const id of TAB_IDS) expect(resolveShareRouteTabId(id)).toBe(id);
  });

  it("falls back safely for unknown/nullish ids", () => {
    expect(resolveShareRouteTabId("nope")).toBe(SHARE_ROUTE_MODAL_CONFIG.defaultTab);
    expect(resolveShareRouteTabId(null)).toBe(SHARE_ROUTE_MODAL_CONFIG.defaultTab);
    expect(resolveShareRouteTabId(undefined)).toBe(SHARE_ROUTE_MODAL_CONFIG.defaultTab);
    expect(resolveShareRouteTabId(42)).toBe(SHARE_ROUTE_MODAL_CONFIG.defaultTab);
  });
});

describe("share-route modal tab wiring", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "features", "posts", "ShareRouteModal.tsx"),
    "utf8",
  );

  it("renders a config-driven tablist with count badge support", () => {
    expect(source).toContain("role=\"tablist\"");
    expect(source).toContain("SHARE_ROUTE_MODAL_CONFIG.tabsAriaLabel");
    expect(source).toContain("shareTabs.map");
    expect(source).toContain("aria-selected");
    expect(source).toContain("route-tabpanel-");
    expect(source).toContain("tab.badge === \"drafts\"");
    expect(source).toContain("ROUTE_DRAFTS_CONFIG.draftsCountLabel");
  });

  it("keeps every section reachable and removes the collapsible headers", () => {
    for (const id of TAB_IDS) expect(source).toContain(`activeTab === "${id}"`);
    expect(source).not.toContain("setShowDrafts");
    expect(source).not.toContain("setPreviewOpen");
    expect(source).not.toContain("setFormOpen");
  });

  it("moves find-on-map into the Map tab", () => {
    const findOnMap = source.slice(source.indexOf("const findOnMap"), source.indexOf("const handlePickOption"));
    expect(findOnMap).toContain('selectTab("map")');
    expect(findOnMap).not.toContain("setPreviewOpen");
  });

  it("details hint links to both Map and Score", () => {
    expect(source).toContain('onClick={() => selectTab("map")}');
    expect(source).toContain('onClick={() => selectTab("score")}');
    expect(source).toContain("SHARE_ROUTE_MODAL_CONFIG.detailsHint.mapLabel");
    expect(source).toContain("SHARE_ROUTE_MODAL_CONFIG.detailsHint.scoreLabel");
  });

  it("score tab keeps the tour anchor visible and opens expanded", () => {
    expect(source).toContain('data-tour={tab.id === "score" ? "route-score" : undefined}');
    expect(source).toContain("defaultOpen");
  });

  it("footer contains only Save Draft + Share actions", () => {
    const footerStart = source.lastIndexOf("<div className=\"flex items-center justify-end gap-2");
    const footer = source.slice(footerStart);
    expect(footer).toContain("saveDraft");
    expect(footer).toContain("handleSubmit");
    expect(footer).not.toContain("setShowDrafts");
    expect(footer).not.toContain("panelToggleLabel");
  });
});

describe("share-route tabs FAQ (en + pidgin)", () => {
  const routes = DEFAULT_FAQ_ITEMS.find((category) => category.id === "routes");
  const item = routes?.items.find((entry) => entry.id === "share-route-tabs");

  it("documents the tabbed composer in English", () => {
    expect(item).toBeDefined();
    expect(item?.question).toMatch(/composer/i);
    expect(item?.answer).toMatch(/Details/i);
    expect(item?.answer).toMatch(/Map/i);
    expect(item?.answer).toMatch(/Score/i);
    expect(item?.answer).toMatch(/Drafts/i);
  });

  it("ships a pidgin alternative", () => {
    expect(FAQ_PCM["share-route-tabs"]?.question).toBeTruthy();
    expect(FAQ_PCM["share-route-tabs"]?.answer).toBeTruthy();
    expect(FAQ_PCM["share-route-tabs"]?.answer).not.toBe(item?.answer);
  });

  it("explains that Find on map switches to the Map tab", () => {
    const all = DEFAULT_FAQ_ITEMS.flatMap((category) => category.items);
    const findOnMap = all.find((entry) => entry.id === "map-find-on-map");
    expect(findOnMap?.answer).toMatch(/Map tab/i);
    expect(FAQ_PCM["map-find-on-map"]?.answer).toMatch(/Map tab/i);
  });
});
