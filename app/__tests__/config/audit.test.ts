import {
  AUDIT_DISPLAY_CONFIG,
  sanitizeAuditText,
  sanitizeAuditDetails,
  auditEntityMeta,
  auditActionMeta,
} from "@/app/lib/config";

describe("audit display config (metadata-driven, sanitized)", () => {
  it("exposes entity + action metadata with tag variants", () => {
    expect(AUDIT_DISPLAY_CONFIG.entities.length).toBeGreaterThan(0);
    expect(AUDIT_DISPLAY_CONFIG.entities.every((e) => e.value && e.label && e.variant)).toBe(true);
    expect(AUDIT_DISPLAY_CONFIG.actions.every((a) => a.prefix && a.label && a.variant)).toBe(true);
    expect(AUDIT_DISPLAY_CONFIG.pageSize).toBeGreaterThan(0);
  });

  it("resolves known entities and actions to friendly labels", () => {
    expect(auditEntityMeta("post").label).toBe("Post");
    expect(auditActionMeta("post.edit").label).toBe("Post edited");
    expect(auditActionMeta("post.archive").label).toBe("Post archived");
    expect(auditActionMeta("user.role").label).toBe("User change");
  });

  it("falls back safely for unknown entity/action values", () => {
    expect(auditEntityMeta("weird-entity").variant).toBe(AUDIT_DISPLAY_CONFIG.fallbackEntityVariant);
    expect(auditActionMeta("weird.action").variant).toBe(AUDIT_DISPLAY_CONFIG.fallbackActionVariant);
  });

  it("strips markup from audit text and caps length", () => {
    expect(sanitizeAuditText('<script>alert(1)</script>hello')).toBe("hello");
    expect(sanitizeAuditText('<b>bold</b>')).toBe("bold");
    expect(sanitizeAuditText(null)).toBe("");
    const long = sanitizeAuditText("x".repeat(5000), 10);
    expect(long.length).toBeLessThanOrEqual(11);
    expect(long.endsWith("…")).toBe(true);
  });

  it("flattens metadata into sanitized chips without throwing", () => {
    const { chips, overflow, fullText } = sanitizeAuditDetails({
      title: '<img src=x onerror=alert(1)>Hello',
      count: 3,
      tags: ["a", "b", "c"],
      nested: { a: 1 },
      nothing: null,
    });
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(AUDIT_DISPLAY_CONFIG.inlineDetailLimit);
    expect(overflow).toBeGreaterThanOrEqual(0);
    expect(chips.every((c) => !c.value.includes("<"))).toBe(true);
    expect(typeof fullText).toBe("string");
  });

  it("returns empty details for non-object metadata", () => {
    expect(sanitizeAuditDetails(null).chips).toEqual([]);
    expect(sanitizeAuditDetails([1, 2]).chips).toEqual([]);
    expect(sanitizeAuditDetails("str").chips).toEqual([]);
    expect(sanitizeAuditDetails({}).chips).toEqual([]);
  });
});
