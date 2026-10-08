import {
  NOTIFICATION_BADGE_CONFIG,
  BADGED_NAV_HREFS,
  NAV_REGISTRY,
} from "@/app/lib/config/navigation";
import { formatBadgeCount } from "@/app/lib/hooks/useUnreadNotifications";
import {
  NOTIFICATION_MESSAGES,
} from "@/app/lib/config/notifications";
import {
  EDIT_PROFILE_FIELDS,
  USERNAME_RULE,
} from "@/app/lib/config/forms";

describe("sprint15: notification nav + badges", () => {
  it("notifications entry exists in the desktop registry", () => {
    expect(NAV_REGISTRY.some((i) => i.href === "/notifications")).toBe(true);
  });

  it("badge config polls cheaply and caps display", () => {
    expect(NOTIFICATION_BADGE_CONFIG.pollMs).toBeGreaterThanOrEqual(30_000);
    expect(NOTIFICATION_BADGE_CONFIG.maxDisplay).toBe(99);
    expect(NOTIFICATION_BADGE_CONFIG.endpoint).toMatch("/api/notifications");
    expect(NOTIFICATION_BADGE_CONFIG.endpoint).toMatch("limit=1");
  });

  it("only the notifications href is badged", () => {
    expect([...BADGED_NAV_HREFS]).toEqual(["/notifications"]);
  });

  it("formats counts with a 99+ cap", () => {
    expect(formatBadgeCount(0)).toBe("0");
    expect(formatBadgeCount(7)).toBe("7");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(1250)).toBe("99+");
  });
});

describe("sprint15: referral + points notification copy", () => {
  it("referral conversion names the new user", () => {
    const msg = NOTIFICATION_MESSAGES.referralConversion("ada_explorer");
    expect(msg).toMatch("@ada_explorer");
    expect(msg.toLowerCase()).toMatch("referral");
  });

  it("points notice states amount and reason", () => {
    const msg = NOTIFICATION_MESSAGES.pointsEarned(100, "Invite accepted");
    expect(msg).toMatch("100");
    expect(msg).toMatch("Invite accepted");
  });

  it("tier-up celebrates the move and urges earning", () => {
    const msg = NOTIFICATION_MESSAGES.tierUp("Bronze", "Silver");
    expect(msg).toMatch("Bronze");
    expect(msg).toMatch("Silver");
    expect(msg.toLowerCase()).toMatch("keep earning");
  });
});

describe("sprint15: username editable with uniqueness rules", () => {
  it("edit-profile form includes username first", () => {
    expect(EDIT_PROFILE_FIELDS[0].name).toBe("userName");
    expect(EDIT_PROFILE_FIELDS.some((f) => f.name === "firstName")).toBe(true);
  });

  it("username rule mirrors signup constraints", () => {
    expect(USERNAME_RULE.minLength).toBe(3);
    expect(USERNAME_RULE.maxLength).toBe(30);
    expect(USERNAME_RULE.pattern.test("ada_explorer")).toBe(true);
    expect(USERNAME_RULE.pattern.test("bad name!")).toBe(false);
  });
});
