/**
 * Profile consistency tightening: avatar forwarding, interaction parity
 * (feed vs profile tabs), and design-token verified pill.
 */
import { PROFILE_POSTS_CONFIG } from "@/app/lib/config/profilePosts";

describe("profile posts consistency config", () => {
  it("forwards avatar fields (never rebuilds a partial user)", () => {
    expect(PROFILE_POSTS_CONFIG.avatarFields).toContain("avatar");
    expect(PROFILE_POSTS_CONFIG.avatarFields).toContain("avatarConfig");
  });

  it("declares viewer-scoped interaction fields", () => {
    expect(PROFILE_POSTS_CONFIG.interactionFields).toContain("_isLiked");
    expect(PROFILE_POSTS_CONFIG.interactionFields).toContain("_isBookmarked");
  });

  it("verified pill uses design tokens (no raw text-white on success bg)", () => {
    expect(PROFILE_POSTS_CONFIG.verifiedPillClass).toContain("bg-success");
    expect(PROFILE_POSTS_CONFIG.verifiedPillClass).toContain("text-success-text");
    expect(PROFILE_POSTS_CONFIG.verifiedPillClass).not.toContain("text-white");
    expect(PROFILE_POSTS_CONFIG.verifiedPillClass).toContain("border-success-border");
  });

  it("unverified pill uses design tokens", () => {
    expect(PROFILE_POSTS_CONFIG.unverifiedPillClass).toContain("bg-warning");
    expect(PROFILE_POSTS_CONFIG.unverifiedPillClass).toContain("text-warning-text");
  });

  it("builds viewer-scoped cache keys", () => {
    expect(PROFILE_POSTS_CONFIG.cacheKeys.ownTab("u1", "posts")).toBe("profile-tab:u1:posts");
    expect(PROFILE_POSTS_CONFIG.cacheKeys.otherTab("u2", "liked")).toBe("profile-tab:u2:liked");
  });
});
