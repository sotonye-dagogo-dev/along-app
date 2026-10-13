/**
 * Feed de-glitch: no row may render twice no matter how score-ordered
 * server pages overlap (cursor is createdAt-based while ranking is
 * score-based). Every feedStream merge path funnels through dedupePosts.
 */
import { dedupePosts } from "@/app/lib/streams/feedStream";
import { FEED_STREAM_CONFIG } from "@/app/lib/config/feedAlgorithm";

const row = (id: string) => ({
  id,
  title: `post ${id}`,
  routes: [],
  images: [],
  tags: [],
  likes: 0,
  dislikes: 0,
  comments: 0,
  bookmarks: 0,
  validityScore: 0,
  validityTier: null,
  createdAt: new Date().toISOString(),
  user: { id: "u1", userName: "u", firstName: "U", lastName: "S" },
});

describe("feed dedup (no redundant rendering)", () => {
  it("drops repeated ids while preserving first-seen order", () => {
    const out = dedupePosts([row("a"), row("b"), row("a"), row("c"), row("b")]);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("skips rows without a usable id", () => {
    const out = dedupePosts([row("a"), { ...row("b"), id: undefined as never }, row("c")]);
    expect(out.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns an empty list for empty input", () => {
    expect(dedupePosts([])).toEqual([]);
  });

  it("is config-driven with sane stream knobs", () => {
    expect(FEED_STREAM_CONFIG.pageSize).toBeGreaterThan(0);
    expect(FEED_STREAM_CONFIG.pollIntervalMs).toBeGreaterThan(0);
    expect(FEED_STREAM_CONFIG.maxExcludeIds).toBeGreaterThan(0);
    expect(FEED_STREAM_CONFIG.freshSec).toBeLessThan(FEED_STREAM_CONFIG.retentionSec);
  });
});
