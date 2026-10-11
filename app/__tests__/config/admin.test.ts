import { formatDelta, inferConfigKind, ADMIN_BULK_SELECT_META, ADMIN_DASHBOARD_PERIODS, ADMIN_USER_DELETION_META, ADMIN_USER_FILTERS, ADMIN_USER_ROW_ACTIONS, ADMIN_TABLE_ACTIONS_META, parseAdminDashboardPeriod, parseAdminUserFilter, deletionQueryForFilter, isDeletedAdminUser, allowedUserRowActions, canShowUserRowAction } from "@/app/lib/config/admin";

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

  it("exposes dashboard data-period options mirroring user analytics (7/30/90)", () => {
    const values = ADMIN_DASHBOARD_PERIODS.options.map((o) => o.value);
    expect(values).toEqual(["7", "30", "90"]);
    expect(ADMIN_DASHBOARD_PERIODS.defaultPeriod).toBe("7");
    for (const o of ADMIN_DASHBOARD_PERIODS.options) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.days).toBe(Number(o.value));
    }
  });

  it("parses dashboard period query values with safe fallbacks", () => {
    expect(parseAdminDashboardPeriod(null)).toBe(7);
    expect(parseAdminDashboardPeriod("garbage")).toBe(7);
    expect(parseAdminDashboardPeriod("7")).toBe(7);
    expect(parseAdminDashboardPeriod("30")).toBe(30);
    expect(parseAdminDashboardPeriod("90")).toBe(90);
    // Out-of-range values clamp to the nearest supported window.
    expect(parseAdminDashboardPeriod("1")).toBe(7);
    expect(parseAdminDashboardPeriod("14")).toBe(30);
    expect(parseAdminDashboardPeriod("365")).toBe(90);
  });

  it("exposes user-deletion copy: reversible request + destructive path with recovery note", () => {
    expect(ADMIN_USER_DELETION_META.requestConfirmLabel.length).toBeGreaterThan(0);
    expect(ADMIN_USER_DELETION_META.deleteNowConfirmLabel.length).toBeGreaterThan(0);
    // Destructive copy must state irreversibility; recovery note must point
    // to the off-platform backup path (no fake in-app undo promise).
    expect(ADMIN_USER_DELETION_META.deleteNowDescription).toMatch(/cannot be undone/i);
    expect(ADMIN_USER_DELETION_META.deleteNowRecoveryNote).toMatch(/backup/i);
    expect(ADMIN_USER_DELETION_META.cancelConfirmLabel.length).toBeGreaterThan(0);
    expect(ADMIN_USER_DELETION_META.selfDeleteGuard.length).toBeGreaterThan(0);
  });

  it("exposes deletion-lifecycle filters including non-deleted (active)", () => {
    const ids = ADMIN_USER_FILTERS.options.map((o) => o.id);
    expect(ids).toContain("all");
    expect(ids).toContain("active");
    expect(ids).toContain("pending");
    expect(ids).toContain("deleted");
    expect(parseAdminUserFilter("active")).toBe("active");
    expect(parseAdminUserFilter("garbage")).toBe("all");
    expect(deletionQueryForFilter("all")).toBeNull();
    expect(deletionQueryForFilter("active")).toBe("active");
    expect(deletionQueryForFilter("pending")).toBe("pending");
    expect(deletionQueryForFilter("deleted")).toBe("deleted");
  });

  it("gates deleted accounts to view-only row actions", () => {
    expect(isDeletedAdminUser({ isDeleted: true })).toBe(true);
    expect(isDeletedAdminUser({ isDeleted: false })).toBe(false);
    expect(isDeletedAdminUser(null)).toBe(false);
    // Deleted → view only (no verify / resend / role changes).
    expect(allowedUserRowActions({ isDeleted: true })).toEqual(["view"]);
    expect(canShowUserRowAction("view", { isDeleted: true })).toBe(true);
    for (const hidden of ADMIN_USER_ROW_ACTIONS.deletedHidden) {
      expect(canShowUserRowAction(hidden, { isDeleted: true })).toBe(false);
    }
    // Active accounts keep the full set; pending swaps request→reverse.
    const active = allowedUserRowActions({ isDeleted: false, deletionScheduledFor: null });
    expect(active).toContain("view");
    expect(active).toContain("verify");
    expect(active).toContain("makeAdmin");
    expect(active).toContain("requestDeletion");
    const pending = allowedUserRowActions({ isDeleted: false, deletionScheduledFor: "2026-01-01" });
    expect(pending).toContain("cancelDeletion");
    expect(pending).not.toContain("requestDeletion");
    // Row-actions dropdown meta stays compact and accessible.
    expect(ADMIN_TABLE_ACTIONS_META.triggerAriaLabel.length).toBeGreaterThan(0);
  });
});
