import {
  getLiveBreakdownForPost,
  attachLiveBreakdownsToPosts,
} from "@/app/lib/services/trustBreakdownService";
import {
  TRUST_DISPLAY_CONFIG,
  trustKeysForVariant,
  trustTierForScore,
} from "@/app/lib/config/trustDisplay";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: async () => ({ verified: false, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }),
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids = args?.where?.id?.in ?? [];
        return ids.map((id: string) => ({ id, verified: false, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }));
      },
    },
    follow: {
      count: async () => 3,
      groupBy: async (args: { where?: { followingId?: { in?: string[] } } }) =>
        (args?.where?.followingId?.in ?? []).map((followingId: string) => ({
          followingId,
          _count: { followingId: 3 },
        })),
    },
    bugReport: {
      count: async () => 0,
      groupBy: async () => [],
    },
    post: {
      count: async () => 4,
    },
    ...overrides,
  };
}

const basePost = {
  id: "post-1",
  userId: "user-1",
  likes: 5,
  dislikes: 1,
  comments: 2,
  bookmarks: 1,
  views: 50,
  shares: 1,
  routes: [
    { location: "A", description: "start", distance: 2, steps: [{}, {}] },
    { location: "B", description: "mid", distance: 3, steps: [{}, {}] },
    { location: "C", description: "end" },
  ],
  tags: ["lekki", "bus"],
  createdAt: new Date(),
};

describe("trust breakdown consistency (feed card == detail)", () => {
  it("single-post and batched paths produce identical components", async () => {
    const prisma = mockPrisma();
    const single = await getLiveBreakdownForPost(prisma, { ...basePost });
    const [batched] = await attachLiveBreakdownsToPosts(prisma, [{ ...basePost }]);
    expect(single).not.toBeNull();
    expect(batched.validityBreakdown).toBeDefined();
    for (const key of ["community", "detail", "corroboration", "recency", "reputation", "engagement"] as const) {
      expect((batched.validityBreakdown as Record<string, number>)[key]).toBe(
        (single as Record<string, number>)[key]
      );
    }
    // Badge numbers agree too: stored row is overwritten with the live score.
    expect(batched.validityScore).toBe(single?.score);
    expect(batched.validityTier).toBe(single?.tier);
  });

  it("same post evaluated twice yields the same corroboration", async () => {
    const prisma = mockPrisma();
    const first = await getLiveBreakdownForPost(prisma, { ...basePost });
    const second = await getLiveBreakdownForPost(prisma, { ...basePost });
    expect(second?.corroboration).toBe(first?.corroboration);
  });

  it("compact card keys are a subset of the full detail keys", () => {
    const compact = trustKeysForVariant("compact");
    const full = trustKeysForVariant("full");
    expect([...compact]).toEqual([...TRUST_DISPLAY_CONFIG.compactKeys]);
    for (const key of compact) {
      expect(full).toContain(key);
    }
    // The four shared rows always include corroboration.
    expect(compact).toContain("corroboration");
  });

  it("tier derivation matches the badge thresholds", () => {
    expect(trustTierForScore(85)).toBe("trusted");
    expect(trustTierForScore(65)).toBe("verified");
    expect(trustTierForScore(35)).toBe("developing");
    expect(trustTierForScore(5)).toBe("low");
  });

  it("list attach never throws and preserves posts on total failure", async () => {
    const failingPrisma = {
      user: { findUnique: async () => { throw new Error("down"); }, findMany: async () => { throw new Error("down"); } },
      follow: { count: async () => { throw new Error("down"); }, groupBy: async () => { throw new Error("down"); } },
      bugReport: { count: async () => { throw new Error("down"); }, groupBy: async () => { throw new Error("down"); } },
      post: { count: async () => { throw new Error("down"); } },
    };
    const posts = [{ ...basePost }, { ...basePost, id: "post-2" }];
    const result = await attachLiveBreakdownsToPosts(failingPrisma, posts);
    // Engine still evaluates with zeroed signals (pure function, no DB).
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("post-1");
  });
});
