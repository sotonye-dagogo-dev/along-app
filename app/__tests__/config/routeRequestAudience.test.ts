import {
  DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG,
  ROUTE_REQUEST_AUDIENCE_CONFIG_KEY,
  normalizeRouteRequestAudienceConfig,
  validateRouteRequestAudienceValue,
} from "@/app/lib/config/routeRequestAudience";
import { getAdminConfigDefault, validateAdminConfigValue } from "@/app/lib/config/admin";

describe("execute-feature: route-request community audience (config-driven)", () => {
  it("ships community-wide defaults (no follow relationship required)", () => {
    expect(DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG.mode).toBe("community");
    expect(DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG.maxRecipients).toBeGreaterThan(0);
    expect(ROUTE_REQUEST_AUDIENCE_CONFIG_KEY).toBe("routeRequestAudience");
  });

  it("normalizes stored SiteConfig values with caps and fallbacks", () => {
    expect(normalizeRouteRequestAudienceConfig(null).mode).toBe("community");
    expect(normalizeRouteRequestAudienceConfig({ mode: "followers" }).mode).toBe("followers");
    // Unknown modes fall back to community (never break fan-out).
    expect(normalizeRouteRequestAudienceConfig({ mode: "everyone" }).mode).toBe("community");
    expect(normalizeRouteRequestAudienceConfig({ maxRecipients: 999999 }).maxRecipients).toBeLessThanOrEqual(5000);
    expect(normalizeRouteRequestAudienceConfig({ maxRecipients: 0 }).maxRecipients).toBeGreaterThanOrEqual(1);
  });

  it("validates admin-supplied values", () => {
    expect(validateRouteRequestAudienceValue({ mode: "community", maxRecipients: 500 })).toBeNull();
    expect(validateRouteRequestAudienceValue({ mode: "everyone" })).toMatch("mode");
    expect(validateRouteRequestAudienceValue({ maxRecipients: 0 })).toMatch("maxRecipients");
    expect(validateRouteRequestAudienceValue("nope")).toMatch("object");
  });

  it("is registered as an admin-configurable default with validation", () => {
    const def = getAdminConfigDefault(ROUTE_REQUEST_AUDIENCE_CONFIG_KEY);
    expect(def).toBeDefined();
    expect(validateAdminConfigValue(ROUTE_REQUEST_AUDIENCE_CONFIG_KEY, { mode: "bogus" })).toMatch("mode");
    expect(validateAdminConfigValue(ROUTE_REQUEST_AUDIENCE_CONFIG_KEY, { mode: "community", maxRecipients: 100 })).toBeNull();
  });
});
