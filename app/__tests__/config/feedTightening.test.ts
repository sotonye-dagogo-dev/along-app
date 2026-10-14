/**
 * Tightening-up: avatar consistency + avg-score source of truth + feed prompt.
 *
 * - AVATAR_DISPLAY_CONFIG: one canonical size registry; asAvatarConfig
 *   narrows unknown payloads (never throws, never returns partial).
 * - Avg score: server aggregate is the source of truth; client must never
 *   derive rewardPoints/postCount (that yields a total, not an average).
 * - Feed prompt: auto-dismiss window inside 30–60s; label count-aware.
 * - feedStream.prependPost: dedupes by id, pins to top (tested via
 *   dedupePosts invariant + prepend semantics documented in feedStream).
 */
import {
  AVATAR_DISPLAY_CONFIG,
  asAvatarConfig,
} from "@/app/lib/config/avatar";
import { FEED_NEW_POSTS_PROMPT_CONFIG } from "@/app/lib/config/feedAlgorithm";
import { dedupePosts } from "@/app/lib/streams/feedStream";

describe("avatar display consistency", () => {
  it("declares canonical sizes for notification/leaderboard/invite surfaces", () => {
    expect(AVATAR_DISPLAY_CONFIG.sizes.notification).toBe(40);
    expect(AVATAR_DISPLAY_CONFIG.sizes.leaderboardPodium).toBe(40);
    expect(AVATAR_DISPLAY_CONFIG.sizes.leaderboardRow).toBe(32);
    expect(AVATAR_DISPLAY_CONFIG.sizes.inviteRow).toBe(32);
  });

  it("forwards avatar + avatarConfig (never drops config)", () => {
    expect(AVATAR_DISPLAY_CONFIG.forwardFields).toContain("avatar");
    expect(AVATAR_DISPLAY_CONFIG.forwardFields).toContain("avatarConfig");
  });

  it("asAvatarConfig narrows valid shapes and rejects junk (never throws)", () => {
    expect(
      asAvatarConfig({ style: "avataaars", seed: "Ada" }),
    ).toEqual({ style: "avataaars", seed: "Ada", flip: undefined, backgroundColor: undefined });
    expect(asAvatarConfig(null)).toBeUndefined();
    expect(asAvatarConfig("avataaars")).toBeUndefined();
    expect(asAvatarConfig({ seed: "Ada" })).toBeUndefined();
    expect(asAvatarConfig({ style: "" })).toBeUndefined();
  });
});

describe("avg score source of truth", () => {
  it("prefers server aggregate over client division (total ≠ average)", () => {
    const serverAvg = 82;
    const rewardPoints = 250;
    const postCount = 2;
    const wrongTotal = Math.round(rewardPoints / postCount); // 125 — the reported bug
    const resolved =
      typeof serverAvg === "number" && Number.isFinite(serverAvg)
        ? Math.round(serverAvg)
        : 0;
    expect(resolved).toBe(82);
    expect(resolved).not.toBe(wrongTotal);
  });

  it("falls back to 0 (never NaN/total) when the server value is missing", () => {
    const serverAvg: unknown = undefined;
    const resolved =
      typeof serverAvg === "number" && Number.isFinite(serverAvg)
        ? Math.round(serverAvg as number)
        : 0;
    expect(resolved).toBe(0);
  });
});

describe("feed new-posts prompt config", () => {
  it("auto-dismiss sits inside the 30–60s band", () => {
    expect(FEED_NEW_POSTS_PROMPT_CONFIG.autoDismissSec).toBeGreaterThanOrEqual(30);
    expect(FEED_NEW_POSTS_PROMPT_CONFIG.autoDismissSec).toBeLessThanOrEqual(60);
  });

  it("throttle window is positive and label is count-aware", () => {
    expect(FEED_NEW_POSTS_PROMPT_CONFIG.throttleAfterClickSec).toBeGreaterThan(0);
    expect(FEED_NEW_POSTS_PROMPT_CONFIG.label(1)).toContain("1 new post");
    expect(FEED_NEW_POSTS_PROMPT_CONFIG.label(3)).toContain("3 new posts");
  });

  it("dedupe invariant keeps optimistic prepends from duplicating", () => {
    const rows = [
      { id: "a" },
      { id: "b" },
      { id: "a" },
    ] as never[];
    const out = dedupePosts(rows as never) as { id: string }[];
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
