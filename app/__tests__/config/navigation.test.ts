import { filterNavItems, NAV_REGISTRY, isAdminRole } from "@/app/lib/config/navigation";

describe("filterNavItems", () => {
  it("returns all non-admin items for user role", () => {
    const items = filterNavItems("user");
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      expect(item.roles).toBeUndefined();
    });
  });

  it("returns admin items for admin role", () => {
    const items = filterNavItems("admin");
    expect(items.some((item) => item.section === "admin")).toBe(true);
  });

  it("filters by main section", () => {
    const items = filterNavItems("user", "main");
    items.forEach((item) => {
      expect(item.section).toBe("main");
    });
  });

  it("filters by admin section", () => {
    const items = filterNavItems("admin", "admin");
    items.forEach((item) => {
      expect(item.section).toBe("admin");
    });
  });

  it("returns empty admin section for user role", () => {
    const items = filterNavItems("user", "admin");
    expect(items.length).toBe(0);
  });

  it("returns all items when no section filter is applied", () => {
    const userItems = filterNavItems("user");
    expect(userItems.length).toBe(NAV_REGISTRY.filter((i) => !i.roles).length);

    const adminItems = filterNavItems("admin");
    expect(adminItems.length).toBe(NAV_REGISTRY.length);
  });

  it("grants admin items for the canonical uppercase DB role", () => {
    // Prisma UserRole is USER | ADMIN — the sidebar must recognise it.
    const items = filterNavItems("ADMIN");
    expect(items.some((item) => item.section === "admin")).toBe(true);
    expect(items.length).toBe(NAV_REGISTRY.length);
  });
});

describe("isAdminRole", () => {
  it("accepts ADMIN in any case", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("Admin")).toBe(true);
  });

  it("rejects non-admin roles and non-strings", () => {
    expect(isAdminRole("USER")).toBe(false);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("MODERATOR")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
