/**
 * Sprint 72 — stop-assignment picker: config sanity (copy/token classes),
 * the pure "Find on map" focus resolver, the persistent CTA labels, and
 * en + pidgin FAQ coverage for the new map flows.
 */
import { MAP_PICKER_CONFIG } from "@/app/lib/config/mapPicker";
import { LOCATION_SUGGESTIONS_CONFIG } from "@/app/lib/config/locationSuggestions";
import { resolveFindOnMapTarget } from "@/app/lib/utils/geo";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("Sprint 72: MAP_PICKER_CONFIG (card + focus hint)", () => {
  it("ships non-empty, emoji-free copy with token-class chrome", () => {
    const copy = [
      MAP_PICKER_CONFIG.cardTitle,
      MAP_PICKER_CONFIG.cardBody,
      MAP_PICKER_CONFIG.dismissLabel,
      MAP_PICKER_CONFIG.focusHint,
    ];
    for (const s of copy) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(EMOJI);
    }
    expect(MAP_PICKER_CONFIG.cardClass).toMatch(/rounded/);
    expect(MAP_PICKER_CONFIG.cardClass).toMatch(/bg-bg-card/);
    expect(MAP_PICKER_CONFIG.focusHintClass).toMatch(/pointer-events-none/);
    expect(MAP_PICKER_CONFIG.focusHintMs).toBeGreaterThan(0);
    expect(MAP_PICKER_CONFIG.focusZoom).toBeGreaterThan(0);
    expect(MAP_PICKER_CONFIG.focusDurationMs).toBeGreaterThan(0);
    expect(MAP_PICKER_CONFIG.cardMaxWidth).toMatch(/^\d+rem$/);
  });

  it("CTA row labels live in config (row under every location input)", () => {
    expect(LOCATION_SUGGESTIONS_CONFIG.currentLocationLabel).toBe("Use my current location");
    expect(LOCATION_SUGGESTIONS_CONFIG.findOnMapLabel).toBe("Find on map");
  });
});

describe("Sprint 72: resolveFindOnMapTarget (pure)", () => {
  it("prefers the stop's own pinned coords", () => {
    const steps = [{ lat: 6.4, lng: 3.4 }, { lat: 6.5, lng: 3.5 }];
    expect(resolveFindOnMapTarget(steps, 1, { lat: 9, lng: 9 })).toEqual({
      lat: 6.5,
      lng: 3.5,
      source: "coords",
    });
  });

  it("walks backwards to the nearest earlier pinned stop when this one has no pin", () => {
    const steps: { lat?: number; lng?: number }[] = [
      { lat: 6.4, lng: 3.4 },
      {},
      {},
      { lat: 6.5, lng: 3.5 },
      {},
    ];
    expect(resolveFindOnMapTarget(steps, 2, { lat: 9, lng: 9 })).toEqual({
      lat: 6.4,
      lng: 3.4,
      source: "previous",
    });
    expect(resolveFindOnMapTarget(steps, 4, { lat: 9, lng: 9 })).toEqual({
      lat: 6.5,
      lng: 3.5,
      source: "previous",
    });
  });

  it("falls back to granted viewer bias only when nothing earlier is pinned", () => {
    const steps: { lat?: number; lng?: number }[] = [{}, {}];
    expect(resolveFindOnMapTarget(steps, 1, { lat: 6.52, lng: 3.37 })).toEqual({
      lat: 6.52,
      lng: 3.37,
      source: "bias",
    });
    expect(resolveFindOnMapTarget(steps, 1, null)).toBeNull();
    expect(resolveFindOnMapTarget(steps, 1)).toBeNull();
  });

  it("ignores placeholder 0,0 and non-finite pins", () => {
    const steps = [{ lat: 0, lng: 0 }, { lat: NaN, lng: 3.4 }, { lat: Infinity, lng: 3.4 }];
    expect(resolveFindOnMapTarget(steps, 0, null)).toBeNull();
    expect(resolveFindOnMapTarget(steps, 1, null)).toBeNull();
    expect(resolveFindOnMapTarget(steps, 2, null)).toBeNull();
    // …and a valid pin SURVIVING a bad earlier one still wins the walk.
    const mixed: { lat?: number; lng?: number }[] = [{ lat: 0, lng: 0 }, { lat: 6.5, lng: 3.5 }, {}];
    expect(resolveFindOnMapTarget(mixed, 2, null)).toEqual({
      lat: 6.5,
      lng: 3.5,
      source: "previous",
    });
    // Origin-first with a placeholder pin has nothing before it → null
    // (the resolver walks backwards only; the caller layers geocode/GPS).
    expect(resolveFindOnMapTarget(mixed, 0, null)).toBeNull();
  });
});

describe("Sprint 72: FAQ documents the new map flows (en + pidgin)", () => {
  const ids = ["map-tap-assign", "map-find-on-map", "map-plus-code", "map-friendly-labels"];

  it("maps category lists each with a real answer", () => {
    const maps = DEFAULT_FAQ_ITEMS.find((c) => c.id === "maps");
    expect(maps).toBeTruthy();
    const have = (maps?.items ?? []).map((i) => i.id);
    for (const id of ids) expect(have).toContain(id);
    for (const id of ids) {
      const item = maps?.items.find((i) => i.id === id);
      expect(item?.question.length).toBeGreaterThan(10);
      expect(item?.answer.length).toBeGreaterThan(40);
      expect(item?.answer).not.toMatch(EMOJI);
    }
  });

  it("ships pidgin translations for each", () => {
    for (const id of ids) {
      const question = FAQ_PCM[id]?.question;
      const answer = FAQ_PCM[id]?.answer;
      expect(question && question.length > 0).toBe(true);
      expect(answer && answer.length > 40).toBe(true);
    }
  });
});
