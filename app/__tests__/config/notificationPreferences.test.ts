import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_KEYS,
  NOTIFICATION_PREFERENCES_META,
  NOTIFICATION_TYPE_TO_PREFERENCE_KEY,
  normalizeNotificationPreferences,
  validateNotificationPreferencesValue,
} from "@/app/lib/config/notificationPreferences";

describe("execute-feature: notification preferences (config-driven, backward compatible)", () => {
  it("defaults to everything on (current platform behaviour)", () => {
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      expect(DEFAULT_NOTIFICATION_PREFERENCES[key]).toBe(true);
    }
  });

  it("resolves NULL / missing / partial stored prefs to defaults (never a raw key)", () => {
    expect(normalizeNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizeNotificationPreferences(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizeNotificationPreferences("nope")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizeNotificationPreferences({})).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    // Partial opt-out merges over defaults; unknown keys are ignored.
    const merged = normalizeNotificationPreferences({ routeRequest: false, bogus: false });
    expect(merged.routeRequest).toBe(false);
    expect(merged.newRoute).toBe(true);
    // Non-boolean values never clobber defaults.
    expect(
      normalizeNotificationPreferences({ like: "no" }).like
    ).toBe(true);
  });

  it("validates client patches (known boolean keys only)", () => {
    expect(validateNotificationPreferencesValue({ routeRequest: false })).toBeNull();
    expect(validateNotificationPreferencesValue({})).toBeNull();
    expect(validateNotificationPreferencesValue(null)).toMatch("object");
    expect(validateNotificationPreferencesValue({ bogus: true })).toMatch("unknown preference");
    expect(validateNotificationPreferencesValue({ like: "yes" })).toMatch("boolean");
  });

  it("maps every fan-out type to a preference key (fail-open unknown = allowed)", () => {
    for (const type of [
      "ROUTE_REQUEST",
      "NEW_ROUTE",
      "ROUTE_RESPONSE",
      "LIKE",
      "DISLIKE",
      "COMMENT",
      "MENTION",
      "FOLLOW",
      "REWARD",
      "BADGE",
      "REPORT",
      "MODERATION",
    ]) {
      const key = NOTIFICATION_TYPE_TO_PREFERENCE_KEY[type];
      expect(key).toBeDefined();
      expect(NOTIFICATION_PREFERENCE_KEYS).toContain(key);
    }
  });

  it("metadata covers every key exactly once (modal is metadata-driven)", () => {
    const covered = NOTIFICATION_PREFERENCES_META.sections.flatMap((s) => [...s.keys]);
    expect(new Set(covered).size).toBe(covered.length);
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      expect(covered).toContain(key);
      expect(NOTIFICATION_PREFERENCES_META.keyLabels[key]).toBeTruthy();
      expect(NOTIFICATION_PREFERENCES_META.keyHints[key]).toBeTruthy();
    }
  });
});
