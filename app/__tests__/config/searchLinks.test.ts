import { NAV_REGISTRY } from "@/app/lib/config/navigation";
import { FOOTER_CONFIG } from "@/app/lib/config/footer";
import { PROFILE_QUICK_LINKS_CONFIG } from "@/app/lib/config/profileQuickLinks";
import type { ProfileQuickLink } from "@/app/lib/config/profileQuickLinks";

// The /search page exists but was unreachable from nav/footer/profile —
// these links must stay present so the page remains discoverable.
describe("search discoverability links", () => {
  it("sidebar registry includes Search → /search", () => {
    const entry = NAV_REGISTRY.find((i) => i.href === "/search");
    expect(entry).toBeDefined();
    expect(entry?.label).toBe("Search");
    expect(entry?.section).toBe("main");
  });

  it("footer Features column links to /search with an i18n key", () => {
    const hrefs = FOOTER_CONFIG.columns.flatMap((c) => c.links.map((l) => l.href));
    expect(hrefs).toContain("/search");
    const link = FOOTER_CONFIG.columns
      .flatMap((c) => c.links)
      .find((l) => l.href === "/search");
    expect(link?.i18nKey).toBe("footer.search");
  });

  it("profile quick-links include the Search route", () => {
    const routes = PROFILE_QUICK_LINKS_CONFIG.filter(
      (l): l is Extract<ProfileQuickLink, { kind: "route" }> => l.kind === "route",
    ).map((l) => l.href);
    expect(routes).toContain("/search");
  });
});
