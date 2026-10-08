import {
  DEFAULT_EARLY_ADOPTER_CONFIG,
  EARLY_ADOPTER_CONFIG_KEY,
  buildEarlyAdopterLabel,
  buildEarlyAdopterTooltip,
  normalizeEarlyAdopterConfig,
  validateEarlyAdopterConfigValue,
} from "@/app/lib/config/earlyAdopter";

describe("early adopter badge config", () => {
  it("exposes a stable SiteConfig key and sane defaults", () => {
    expect(EARLY_ADOPTER_CONFIG_KEY).toBe("earlyAdopterConfig");
    expect(DEFAULT_EARLY_ADOPTER_CONFIG.enabled).toBe(true);
    expect(DEFAULT_EARLY_ADOPTER_CONFIG.limit).toBeGreaterThan(0);
    expect(DEFAULT_EARLY_ADOPTER_CONFIG.badgeLabelTemplate).toContain("{N}");
    expect(DEFAULT_EARLY_ADOPTER_CONFIG.badgeLabelTemplate).toContain("{rank}");
  });

  it("builds labels like 'First 100 Users #42'", () => {
    expect(
      buildEarlyAdopterLabel({ limit: 100, badgeLabelTemplate: "First {N} Users #{rank}" }, 42)
    ).toBe("First 100 Users #42");
    expect(
      buildEarlyAdopterLabel({ limit: 50, badgeLabelTemplate: "First {N} Users #{rank}" }, 1)
    ).toBe("First 50 Users #1");
  });

  it("builds tooltip text with rank and total", () => {
    expect(buildEarlyAdopterTooltip(100, 7)).toContain("100");
    expect(buildEarlyAdopterTooltip(100, 7)).toContain("#7");
  });

  it("normalizes stored values onto defaults without throwing", () => {
    expect(normalizeEarlyAdopterConfig(null)).toEqual(DEFAULT_EARLY_ADOPTER_CONFIG);
    expect(normalizeEarlyAdopterConfig(undefined)).toEqual(DEFAULT_EARLY_ADOPTER_CONFIG);
    expect(
      normalizeEarlyAdopterConfig({ enabled: false, limit: 25, badgeLabelTemplate: "Top {N} #{rank}" })
    ).toEqual({ enabled: false, limit: 25, badgeLabelTemplate: "Top {N} #{rank}" });
    // Garbage shapes fall back safely
    const normalized = normalizeEarlyAdopterConfig({ enabled: "yes", limit: -5, badgeLabelTemplate: "" });
    expect(normalized.enabled).toBe(true);
    expect(normalized.limit).toBeGreaterThanOrEqual(1);
    expect(normalized.badgeLabelTemplate.length).toBeGreaterThan(0);
  });

  it("validates admin-supplied values", () => {
    expect(
      validateEarlyAdopterConfigValue({ enabled: true, limit: 100, badgeLabelTemplate: "First {N} Users #{rank}" })
    ).toBeNull();
    expect(
      validateEarlyAdopterConfigValue({ enabled: "yes", limit: 100, badgeLabelTemplate: "x" })
    ).not.toBeNull();
    expect(
      validateEarlyAdopterConfigValue({ enabled: true, limit: 0, badgeLabelTemplate: "x" })
    ).not.toBeNull();
    expect(
      validateEarlyAdopterConfigValue({ enabled: true, limit: 100, badgeLabelTemplate: "" })
    ).not.toBeNull();
    expect(validateEarlyAdopterConfigValue(null)).not.toBeNull();
  });
});
