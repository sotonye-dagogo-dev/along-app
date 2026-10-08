import { formatDelta, inferConfigKind, ADMIN_BULK_SELECT_META } from "@/app/lib/config/admin";

describe("admin metrics + config metadata", () => {
  it("never shows a positive/negative trend for a zero value with no movement", () => {
    expect(formatDelta(0, 0)).toEqual({ label: "No change", direction: "flat" });
    expect(formatDelta(null, 0)).toEqual({ label: "No data", direction: "flat" });
  });

  it("reports real deltas otherwise", () => {
    expect(formatDelta(8.2, 120)).toEqual({ label: "+8.2%", direction: "up" });
    expect(formatDelta(-3.5, 40)).toEqual({ label: "-3.5%", direction: "down" });
    expect(formatDelta(0, 40)).toEqual({ label: "No change", direction: "flat" });
  });

  it("infers non-programmer field kinds", () => {
    expect(inferConfigKind("x", true)).toBe("boolean");
    expect(inferConfigKind("x", 42)).toBe("number");
    expect(inferConfigKind("x", "hello")).toBe("text");
    expect(inferConfigKind("x", { a: 1 })).toBe("json");
  });

  it("exposes bulk quick presets including first-N", () => {
    expect(ADMIN_BULK_SELECT_META.quickPresets.length).toBeGreaterThan(0);
    expect(ADMIN_BULK_SELECT_META.actions).toContain("selectAll");
    expect(ADMIN_BULK_SELECT_META.actions).toContain("invert");
  });
});
