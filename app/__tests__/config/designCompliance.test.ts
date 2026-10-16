/**
 * Design-system compliance + Config Studio parity (directive):
 * - Vehicle flags, tier shields, and status pills stay visible in light
 *   theme (saturated wash + dark text + border, never near-white bg with
 *   white/light text).
 * - Admin config ships hardcoded defaults, merges stored-wins at read time,
 *   validates centrally, and restores via row deletion (Email/Blog parity).
 */
import {
  ADMIN_CONFIG_DEFAULTS,
  ADMIN_SIMPLE_CONFIG_CARDS,
  ADMIN_DEDICATED_CONFIG_KEYS,
  ADMIN_STUDIO_LINKS,
  ADMIN_STUDIO_MANAGED_KEYS,
  getAdminConfigDefault,
  mergeAdminConfigsWithDefaults,
  validateAdminConfigValue,
} from "@/app/lib/config/admin";
import {
  REWARD_TIERS,
  REWARD_TIER_DISPLAY,
  rewardTierPillClass,
} from "@/app/lib/config/rewards";

describe("admin config defaults registry (DB-aware, rollback-capable)", () => {
  it("ships a hardcoded default for every managed key", () => {
    const keys = ADMIN_CONFIG_DEFAULTS.map((d) => d.key);
    for (const expected of [
      "earlyAdopterConfig",
      "feedDiversity",
      "feedAlgorithm",
      "feedStream",
      "emailConfig",
      "maintenanceMode",
      "announcementBanner",
      "inviteRewardPoints",
    ]) {
      expect(keys).toContain(expected);
    }
    for (const def of ADMIN_CONFIG_DEFAULTS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.defaultValue).not.toBeUndefined();
    }
  });

  it("every default key has a no-code card or a studio link (never JSON-only)", () => {
    const cardKeys = new Set([
      ...ADMIN_SIMPLE_CONFIG_CARDS.map((c) => c.key),
      "earlyAdopterConfig",
      "feedDiversity",
      ...ADMIN_STUDIO_LINKS.flatMap((s) => [...s.keys]),
    ]);
    for (const def of ADMIN_CONFIG_DEFAULTS) {
      expect(cardKeys.has(def.key)).toBe(true);
    }
    // Dedicated keys stay out of the raw JSON list (one editor per key).
    for (const def of ADMIN_CONFIG_DEFAULTS) {
      expect(
        (ADMIN_DEDICATED_CONFIG_KEYS as readonly string[]).includes(def.key)
      ).toBe(true);
    }
  });

  it("blog + email sections link to their studios (never inline editors)", () => {
    // Every studio-managed key is hidden from the raw list via dedicated keys.
    for (const key of ADMIN_STUDIO_MANAGED_KEYS) {
      expect(
        (ADMIN_DEDICATED_CONFIG_KEYS as readonly string[]).includes(key)
      ).toBe(true);
    }
    // Studio links point at the real admin studios with a CTA each.
    const hrefs = ADMIN_STUDIO_LINKS.map((s) => s.href).sort();
    expect(hrefs).toEqual(["/admin/blog", "/admin/email"]);
    for (const studio of ADMIN_STUDIO_LINKS) {
      expect(studio.title.length).toBeGreaterThan(0);
      expect(studio.description.length).toBeGreaterThan(0);
      expect(studio.ctaLabel.length).toBeGreaterThan(0);
      expect(studio.keys.length).toBeGreaterThan(0);
    }
    // No simple (inline-editable) card duplicates a studio-managed key.
    const simpleKeys = ADMIN_SIMPLE_CONFIG_CARDS.map((c) => c.key);
    for (const key of ADMIN_STUDIO_MANAGED_KEYS) {
      expect(simpleKeys).not.toContain(key);
    }
  });

  it("merges stored-wins with shipped backfill (never throws)", () => {
    const merged = mergeAdminConfigsWithDefaults([
      { key: "maintenanceMode", value: true },
      { key: "myCustomKey", value: "hello" },
    ]);
    const byKey = new Map(merged.map((m) => [m.key, m]));
    // Stored wins…
    expect(byKey.get("maintenanceMode")).toMatchObject({
      value: true,
      source: "customized",
    });
    // …unknown stored keys pass through as custom…
    expect(byKey.get("myCustomKey")?.source).toBe("custom");
    // …and missing shipped defaults backfill as default-sourced.
    expect(byKey.get("announcementBanner")?.source).toBe("default");
    expect(byKey.get("announcementBanner")?.value).toBe(
      getAdminConfigDefault("announcementBanner")?.defaultValue
    );
    // Garbage input never throws — it degrades to the full default board
    // (fresh database still renders a fully configurable page).
    const nullMerge = mergeAdminConfigsWithDefaults(null as never);
    expect(nullMerge.length).toBe(ADMIN_CONFIG_DEFAULTS.length);
    expect(nullMerge.every((m) => m.source === "default")).toBe(true);
    expect(mergeAdminConfigsWithDefaults("garbage" as never).length).toBe(
      ADMIN_CONFIG_DEFAULTS.length
    );
  });

  it("validates known keys centrally (delegates to existing validators)", () => {
    // Delegation parity: same accept/reject as the module validators.
    expect(
      validateAdminConfigValue("earlyAdopterConfig", {
        enabled: true,
        limit: 100,
        badgeLabelTemplate: "First {N} Users #{rank}",
      })
    ).toBeNull();
    expect(
      validateAdminConfigValue("earlyAdopterConfig", {
        enabled: "yes",
        limit: 100,
        badgeLabelTemplate: "x",
      })
    ).not.toBeNull();
    expect(
      validateAdminConfigValue("feedDiversity", {
        maxConsecutiveFromSameAuthor: 2,
        lookaheadWindow: 8,
        jitterWeight: 0.02,
      })
    ).toBeNull();
    expect(
      validateAdminConfigValue("feedDiversity", {
        maxConsecutiveFromSameAuthor: 0,
      })
    ).not.toBeNull();
    // New gates.
    expect(validateAdminConfigValue("maintenanceMode", true)).toBeNull();
    expect(validateAdminConfigValue("maintenanceMode", "yes")).not.toBeNull();
    expect(validateAdminConfigValue("announcementBanner", "hi")).toBeNull();
    expect(validateAdminConfigValue("announcementBanner", 42)).not.toBeNull();
    expect(validateAdminConfigValue("inviteRewardPoints", 100)).toBeNull();
    expect(validateAdminConfigValue("inviteRewardPoints", -1)).not.toBeNull();
    expect(
      validateAdminConfigValue("emailConfig", {
        fromName: "Along",
        fromEmail: "mail@alongng.com",
        replyTo: "support@alongng.com",
      })
    ).toBeNull();
    expect(
      validateAdminConfigValue("emailConfig", { fromEmail: "not-an-email" })
    ).not.toBeNull();
    expect(
      validateAdminConfigValue("feedAlgorithm", { followingWeight: 0.7 })
    ).toBeNull();
    expect(
      validateAdminConfigValue("feedAlgorithm", { followingWeight: "lots" })
    ).not.toBeNull();
    expect(validateAdminConfigValue("feedAlgorithm", "nope")).not.toBeNull();
    expect(
      validateAdminConfigValue("feedStream", { pageSize: 10 })
    ).toBeNull();
    expect(validateAdminConfigValue("feedStream", null)).not.toBeNull();
    // Unknown ad-hoc keys pass (generic kind editors validate them).
    expect(validateAdminConfigValue("someCustomKey", "anything")).toBeNull();
    expect(validateAdminConfigValue("someCustomKey", undefined)).toBeNull();
  });
});

describe("reward tier shield display (light-theme visible)", () => {
  it("every tier has a display pill with light + dark variants", () => {
    for (const tier of Object.keys(REWARD_TIERS)) {
      const display = REWARD_TIER_DISPLAY[tier];
      expect(display).toBeTruthy();
      expect(display.pillClass).toContain("dark:");
      expect(display.pillClass).toMatch(/border/);
    }
  });

  it("display pills never use raw metallic text on a light wash", () => {
    // SILVER #C0C0C0 / GOLD #FFD700 / PLATINUM #E5E4E2 as text on a light
    // pill is what made shields invisible — pills must use dark-grade text.
    for (const tier of Object.keys(REWARD_TIERS)) {
      const pill = rewardTierPillClass(tier);
      for (const invisible of ["#C0C0C0", "#FFD700", "#E5E4E2"]) {
        expect(pill).not.toContain(invisible);
      }
      expect(pill).toMatch(/text-(amber|slate|yellow|gray)-[89]00/);
    }
  });

  it("unknown tiers fall back to a neutral token pill (never unstyled)", () => {
    expect(rewardTierPillClass("DIAMOND")).toContain("bg-bg-elevated");
    expect(rewardTierPillClass("")).toContain("bg-bg-elevated");
  });
});
