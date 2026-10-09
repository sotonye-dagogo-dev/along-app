/**
 * @jest-environment jsdom
 *
 * Tightening-up: anchor-stable numbered pins, token-styled user dot,
 * light-parity dark mode, draft update-in-place, FAQ accuracy.
 */
import { MAP_PINS_CONFIG, routePinLabel } from "@/app/lib/config/mapPins";
import { MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts";
import { DEFAULT_FAQ_ITEMS } from "@/app/lib/config/faq";
import { routeDraftsService } from "@/app/lib/services/routeDraftsService";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
  return { store };
}

describe("map pins: anchor-stable, numbered, token-driven", () => {
  it("marker anchor is center with zero offset (tracks lngLat through pan/zoom)", () => {
    expect(MAP_PINS_CONFIG.markerAnchor).toBe("center");
    expect(MAP_PINS_CONFIG.markerOffset).toEqual([0, 0]);
  });

  it("route labels are 1-based stop numbers", () => {
    expect(routePinLabel(0)).toBe("1");
    expect(routePinLabel(2)).toBe("3");
  });

  it("pin visuals use design-token classes (no hardcoded hex)", () => {
    const hex = /#[0-9a-fA-F]{3,8}/;
    expect(MAP_PINS_CONFIG.routeDot.dotClass).not.toMatch(hex);
    expect(MAP_PINS_CONFIG.userDot.coreClass).not.toMatch(hex);
    expect(MAP_PINS_CONFIG.userDot.radarClass).not.toMatch(hex);
    expect(MAP_PINS_CONFIG.routeDot.dotClass).toMatch("primary");
  });
});

describe("dark mode keeps light visual params", () => {
  it("no canvas filter and dark raster mirrors light", () => {
    expect(MAP_STACK_CONFIG.darkCanvasFilter).toBe("none");
    expect(MAP_STACK_CONFIG.rasterFallbacks.dark[0]).toBe(
      MAP_STACK_CONFIG.rasterFallbacks.light[0]
    );
  });
});

describe("drafts update in place", () => {
  it("updateDraft keeps the same id and refreshes content", () => {
    installMemoryStorage();
    const created = routeDraftsService.saveDraft({
      title: "Marina to Yaba",
      steps: [
        { location: "Marina", description: "", vehicle: "bus", fare: 500 },
        { location: "Yaba", description: "", vehicle: "bus", fare: 300 },
      ],
      tags: [],
      images: [],
    });
    expect(created).not.toBeNull();
    const updated = routeDraftsService.updateDraft(created!.id, {
      title: "Marina to Yaba edited",
      steps: [
        { location: "Marina", description: "", vehicle: "bus", fare: 500 },
        { location: "Yaba", description: "", vehicle: "bus", fare: 350 },
      ],
      tags: ["lagos"],
      images: [],
    });
    expect(updated?.id).toBe(created!.id);
    expect(updated?.title).toBe("Marina to Yaba edited");
    expect(routeDraftsService.listDrafts()).toHaveLength(1);
    expect(ROUTE_DRAFTS_CONFIG.updateLabel.length).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.saveAsNewLabel.length).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.updatePromptText.length).toBeGreaterThan(0);
  });
});

describe("FAQ accuracy", () => {
  it("report answer uses the in-post Report flow (not the bug page)", () => {
    const all = DEFAULT_FAQ_ITEMS.flatMap((c) => c.items);
    const report = all.find((i) => i.id === "report-content");
    expect(report).toBeDefined();
    expect(report!.answer).toMatch(/Report/);
    expect(report!.answer).not.toMatch(/Use the Report Bug page to flag/);
  });

  it("has map usage FAQs covering tracings, pins, zoom and move", () => {
    const all = DEFAULT_FAQ_ITEMS.flatMap((c) => c.items);
    const reading = all.find((i) => i.id === "map-tracings-pins");
    const gesture = all.find((i) => i.id === "map-zoom-move-mobile");
    expect(reading?.answer).toMatch(/tracing/i);
    expect(reading?.answer).toMatch(/numbered/i);
    expect(gesture?.answer).toMatch(/pinch/i);
  });
});
