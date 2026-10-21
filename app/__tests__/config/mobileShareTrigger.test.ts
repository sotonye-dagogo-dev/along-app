/**
 * Bottom mobile tab bar — Share Route FAB must open the composer directly.
 *
 * Regression: the FAB used to be a `<Link href="/home?share=true">`. When the
 * URL was already `/home?share=true` (after closing the modal) or Next treated
 * the identical href as a no-op, tapping the button did nothing even though
 * the desktop-sidebar trigger (local state) always worked.
 */
import fs from "fs";
import path from "path";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("mobile bottom-bar Share Route trigger", () => {
  const nav = read("app/components/ui/DashboardNav.tsx");
  const fabStart = nav.indexOf("if (tab.isFab)");
  const fabEnd = nav.indexOf("const active = isActive(tab.href)", fabStart);
  const fab = nav.slice(fabStart, fabEnd);

  it("opens the local composer instead of navigating through the query string", () => {
    expect(fabStart).toBeGreaterThan(-1);
    expect(fab).toContain("onClick={() => setShowShareModal(true)}");
    expect(fab).not.toContain("href={tab.href}");
    expect(fab).toContain('type="button"');
  });

  it("uses the same mounted modal + submit handler as the desktop sidebar", () => {
    expect(nav).toContain("setShowShareModal(true)");
    expect(nav).toContain("<ShareRouteModal");
    expect(nav).toContain("isOpen={showShareModal}");
    expect(nav).toContain("onSubmit={handleShareSubmit}");
  });
});
