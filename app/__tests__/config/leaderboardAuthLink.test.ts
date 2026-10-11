import { FOOTER_CONFIG } from "@/app/lib/config/footer";
import { LEADERBOARD_LINKS_CONFIG } from "@/app/lib/config/leaderboardLinks";
import { PROFILE_QUICK_LINKS_CONFIG } from "@/app/lib/config/profileQuickLinks";
import type { ProfileQuickLink } from "@/app/lib/config/profileQuickLinks";
import {
  AUTH_LINK_STATUS_CONFIG,
  resolveAuthLinkState,
  authLinkStatusCopy,
} from "@/app/lib/config/authLink";

describe("leaderboard cross-links + auth-link status", () => {
  it("footer links to the global leaderboard (config-driven)", () => {
    const hrefs = FOOTER_CONFIG.columns.flatMap((c) => c.links.map((l) => l.href));
    expect(hrefs).toContain("/leaderboard");
    expect(hrefs).toContain(LEADERBOARD_LINKS_CONFIG.route);
  });

  it("profile quick-links include the leaderboard route", () => {
    const routes = PROFILE_QUICK_LINKS_CONFIG.filter(
      (l): l is Extract<ProfileQuickLink, { kind: "route" }> => l.kind === "route",
    ).map((l) => l.href);
    expect(routes).toContain("/leaderboard");
  });

  it("invite CTA points at the global leaderboard", () => {
    expect(LEADERBOARD_LINKS_CONFIG.inviteCta.href).toBe("/leaderboard");
  });

  it("resolves auth-link states without overlap", () => {
    expect(resolveAuthLinkState(true, true)).toBe("both");
    expect(resolveAuthLinkState(true, false)).toBe("googleOnly");
    expect(resolveAuthLinkState(false, true)).toBe("passwordOnly");
    expect(resolveAuthLinkState(false, false)).toBe("none");
  });

  it("carries distinct copy per connected-auth combination", () => {
    expect(authLinkStatusCopy(true, true)).toBe(AUTH_LINK_STATUS_CONFIG.bothConnected);
    expect(authLinkStatusCopy(true, false)).toBe(AUTH_LINK_STATUS_CONFIG.googleOnly);
    expect(authLinkStatusCopy(false, true)).toBe(AUTH_LINK_STATUS_CONFIG.passwordOnly);
    expect(authLinkStatusCopy(false, false)).toBe(AUTH_LINK_STATUS_CONFIG.none);
  });
});
