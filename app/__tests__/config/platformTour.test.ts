/**
 * Platform tour — config/integrity/registration contract (Sprint 82).
 * Keeps the tour config metadata sound, registered for offline caching,
 * admin-manageable, replay-wired, and FAQ/PCM documented.
 */
import fs from "fs";
import path from "path";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  PLATFORM_TOUR_CONFIG_KEY,
  PLATFORM_TOUR_STATE_VERSION,
  PLATFORM_TOUR_MANAGED_FIELDS,
  TOUR_START_EVENT,
  coerceStepIndex,
  isLastStep,
  isTourTerminal,
  normalizePlatformTourConfig,
  readTourStateShape,
  validatePlatformTourConfigValue,
  type PlatformTourConfig,
} from "@/app/lib/config/platformTour";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";
import {
  ADMIN_SIMPLE_CONFIG_CARDS,
  getAdminConfigDefault,
  mergeAdminConfigsWithDefaults,
  validateAdminConfigValue,
} from "@/app/lib/config/admin";
import { API_REGISTRY } from "@/app/lib/config/apiRegistry";
import { PWA_CACHEABLE_API_PREFIXES, PWA_NEVER_CACHE_API } from "@/app/lib/config/pwa";
import { PROFILE_QUICK_LINKS_CONFIG } from "@/app/lib/config/profileQuickLinks";

/** Routes a dashboard tour step is allowed to live on. */
const DASHBOARD_ROUTES = [
  "/home",
  "/explore",
  "/search",
  "/profile",
  "/notifications",
  "/bookmarks",
  "/analytics",
  "/leaderboard",
  "/invite",
  "/posts",
] as const;

describe("platform tour config", () => {
  it("steps are unique, dashboard-scoped, and copy-backed", () => {
    const steps = DEFAULT_PLATFORM_TOUR_CONFIG.steps;
    expect(steps.length).toBeGreaterThan(0);
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of steps) {
      expect(step.id.match(/^[a-z0-9-]+$/)).toBeTruthy();
      expect(DASHBOARD_ROUTES.some((route) => step.route.startsWith(route))).toBe(true);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(20);
      expect(step.route.startsWith("/")).toBe(true);
    }
  });

  it("target selectors exist only for spotlight steps and parse cleanly", () => {
    for (const step of DEFAULT_PLATFORM_TOUR_CONFIG.steps) {
      if (!step.targetSelector) continue;
      for (const part of step.targetSelector.split(",").map((p) => p.trim()).filter(Boolean)) {
        expect(/^[#.\[]/.test(part)).toBe(true);
      }
      if (step.interactive) expect(step.targetSelector.length).toBeGreaterThan(0);
    }
    // At least one interactive step (interaction requirement of the tour UX).
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.steps.some((s) => s.interactive)).toBe(true);
    // At least one centered no-spot step (welcome) and the end card.
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.steps[0].targetSelector).toBeUndefined();
  });

  it("placement values and managed fields stay in their unions", () => {
    for (const step of DEFAULT_PLATFORM_TOUR_CONFIG.steps) {
      if (step.placement) expect(["top", "bottom", "left", "right"]).toContain(step.placement);
    }
    expect([...PLATFORM_TOUR_MANAGED_FIELDS]).toEqual(["enabled", "autoStart", "autoStartDelayMs"]);
  });

  it("primary knobs have safe defaults (enabled + logo mascot fallback)", () => {
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.autoStartDelayMs).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.display.mascotImage).toBe("");
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.display.mascotAlt.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.storage.stateKey).toMatch(/^along-tour-state-/);
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.endCard.ctaHref).toMatch(/^\//);
    expect(DEFAULT_PLATFORM_TOUR_CONFIG.offline.endLabel.trim().length).toBeGreaterThan(0);
  });

  it("step locale keys resolve to the tour.* namespace", () => {
    for (const step of DEFAULT_PLATFORM_TOUR_CONFIG.steps) {
      if (step.titleKey) expect(step.titleKey).toMatch(/^tour\./);
      if (step.bodyKey) expect(step.bodyKey).toMatch(/^tour\./);
    }
  });
});

describe("platform tour helpers", () => {
  it("coerceStepIndex clamps into range and degrades garbage to 0", () => {
    const n = DEFAULT_PLATFORM_TOUR_CONFIG.steps.length;
    expect(coerceStepIndex(0, n)).toBe(0);
    expect(coerceStepIndex(n - 1, n)).toBe(n - 1);
    expect(coerceStepIndex(99, n)).toBe(n - 1);
    expect(coerceStepIndex(-5, n)).toBe(0);
    expect(coerceStepIndex(Number.NaN, n)).toBe(0);
    expect(coerceStepIndex(3, 0)).toBe(0);
    expect(isLastStep(n - 1, n)).toBe(true);
    expect(isLastStep(0, n)).toBe(false);
  });

  it("readTourStateShape accepts only versioned blobs and marks terminals", () => {
    expect(readTourStateShape(null)).toBeNull();
    expect(readTourStateShape("not json")).toBeNull();
    expect(readTourStateShape("{}")).toBeNull();
    expect(readTourStateShape("2")).toBeNull();
    const blob = JSON.stringify({
      version: PLATFORM_TOUR_STATE_VERSION,
      startedAt: 111,
      stepIndex: 2,
      completedAt: 999,
    });
    const state = readTourStateShape(blob);
    expect(state).not.toBeNull();
    expect(state?.stepIndex).toBe(2);
    expect(isTourTerminal(state)).toBe(true);
    expect(isTourTerminal(readTourStateShape(JSON.stringify({ version: PLATFORM_TOUR_STATE_VERSION, startedAt: 1 })))).toBe(false);
    expect(isTourTerminal(null)).toBe(false);
  });

  it("normalize merges stored rows field-wise and survives corruption", () => {
    const fallback = DEFAULT_PLATFORM_TOUR_CONFIG;
    const merged = normalizePlatformTourConfig(
      { enabled: false, autoStartDelayMs: 10000, display: { spotPadPx: 999 }, nonsense: true },
      fallback,
    );
    expect(merged.enabled).toBe(false);
    expect(merged.autoStartDelayMs).toBe(10000);
    expect(merged.display.spotPadPx).toBe(48);
    expect(merged.steps.length).toBe(fallback.steps.length);
    expect(merged.steps[0].id).toBe(fallback.steps[0].id);

    const clamped = normalizePlatformTourConfig(
      { autoStartDelayMs: 999999 },
      fallback,
    );
    expect(clamped.autoStartDelayMs).toBe(60000);

    for (const garbage of [null, undefined, "string", 5, [], { steps: "nope" }]) {
      expect(normalizePlatformTourConfig(garbage, fallback)).toEqual(fallback);
    }
  });

  it("normalize keeps a replacement step list only when it is well-formed", () => {
    const replacement: PlatformTourConfig = normalizePlatformTourConfig(
      {
        steps: [
          { id: "custom-a", route: "/bookmarks", title: "Custom", body: "Custom body text long enough." },
          { id: "custom-b", route: "not-a-route", title: "", placement: "diagonal" },
        ],
      },
      DEFAULT_PLATFORM_TOUR_CONFIG,
    );
    expect(replacement.steps[0].id).toBe("custom-a");
    expect(replacement.steps[0].route).toBe("/bookmarks");
    // Bad route/title/placement degrade to safe shapes, keeping the step.
    expect(replacement.steps[1].route).toBe("/home");
    expect(replacement.steps[1].title.length).toBeGreaterThan(0);
    expect(replacement.steps[1].placement).toBeUndefined();
  });
});

describe("platform tour admin config", () => {
  it("ships a default + simple card + validator wiring", () => {
    const def = getAdminConfigDefault(PLATFORM_TOUR_CONFIG_KEY);
    expect(def).toBeDefined();
    expect((def?.defaultValue as { enabled?: boolean } | undefined)?.enabled).toBe(true);
    const card = ADMIN_SIMPLE_CONFIG_CARDS.find((c) => c.key === PLATFORM_TOUR_CONFIG_KEY);
    expect(card).toBeDefined();
    expect(["enabled", "autoStart", "autoStartDelayMs"].every((id) => card!.fields.some((f) => f.id === id))).toBe(true);
  });

  it("central validator rejects bad shapes with clear messages", () => {
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { enabled: true })).toBeNull();
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { enabled: true, autoStartDelayMs: 1200 })).toBeNull();
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { enabled: "yes" })).toMatch(/enabled/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { autoStartDelayMs: -1 })).toMatch(/non-negative/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { autoStartDelayMs: 999999 })).toMatch(/60000/);
    expect(
      validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, {
        steps: [{ id: "x", route: "/home", title: "Hi" }, null],
      }),
    ).toMatch(/object/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { steps: [{ id: "x", route: "/home", title: "Hi" }] })).toBeNull();
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { steps: [{ id: "  ", route: "/home", title: "Hi" }] })).toMatch(/id/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, { steps: [{ id: "x", route: "/home", title: "Hi", placement: "side" }] })).toMatch(/placement/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, 42)).toMatch(/object/);
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, null)).toBeNull();
    expect(validateAdminConfigValue(PLATFORM_TOUR_CONFIG_KEY, undefined)).toBeNull();
    expect(validatePlatformTourConfigValue({ display: { spotPadPx: 8 } })).toBeNull();
    expect(validatePlatformTourConfigValue({ display: "no" })).toMatch(/display/);
  });

  it("stored partial rows merge over the default at read time", () => {
    const merged = mergeAdminConfigsWithDefaults([{ key: PLATFORM_TOUR_CONFIG_KEY, value: { enabled: false } } as never]);
    const entry = merged.find((c) => c.key === PLATFORM_TOUR_CONFIG_KEY);
    expect(entry).toBeDefined();
    expect((entry?.value as { enabled?: boolean }).enabled).toBe(false);
    expect((entry?.value as { autoStart?: boolean }).autoStart).toBe(((getAdminConfigDefault(PLATFORM_TOUR_CONFIG_KEY) as unknown) as { autoStart: boolean }).autoStart);
  });
});

describe("platform tour registration (offline + api surface)", () => {
  it("/api/tour is SWR-cacheable, guest-safe, and never-cache-blocked", () => {
    expect(API_REGISTRY.platformTour).toEqual({ path: "/api/tour", methods: ["GET"], auth: false });
    expect(PWA_CACHEABLE_API_PREFIXES.some((p) => p === "/api/tour")).toBe(true);
    expect(PWA_NEVER_CACHE_API.some((p) => "/api/tour".startsWith(p))).toBe(false);
    const swSource = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
    expect(swSource).toContain('"/api/tour"');
  });

  it("component mounts survive layout refactors", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "app", "(dashboard)", "layout.tsx"), "utf8");
    expect(layout).toContain("PlatformTour");
    const root = fs.readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(root).toContain("ReviewNotice");
  });

  it("profile quick links expose the tour replay action", () => {
    const replay = PROFILE_QUICK_LINKS_CONFIG.find((l) => l.kind === "action");
    expect(replay).toBeDefined();
    expect(replay?.id).toBe("tour-replay");
    if (replay?.kind === "action") expect(replay.event).toBe(TOUR_START_EVENT);
    const ids = PROFILE_QUICK_LINKS_CONFIG.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(replay?.i18nKey).toBe("tour.replay");
  });
});

describe("platform tour FAQ (en + pidgin)", () => {
  const category = DEFAULT_FAQ_ITEMS.find((c) => c.id === "tour");
  const TOUR_ITEM_IDS = ["tour-what-is-it", "tour-interact", "tour-replay-offline"];

  it("ships a Platform Tour category with the contract items", () => {
    expect(category).toBeDefined();
    expect(category?.category).toBe("Platform Tour");
    const ids = category?.items.map((i) => i.id) ?? [];
    for (const id of TOUR_ITEM_IDS) expect(ids).toContain(id);
    for (const item of category?.items ?? []) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(20);
    }
  });

  it("every tour FAQ item has a pidgin question + answer", () => {
    for (const id of TOUR_ITEM_IDS) {
      expect(FAQ_PCM[id]?.question).toBeTruthy();
      expect(FAQ_PCM[id]?.answer).toBeTruthy();
    }
  });
});
