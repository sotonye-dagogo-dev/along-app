/**
 * NOTE: `@/app/lib/db/redis` is stubbed here (hoisted `jest.mock`) because
 * its `@upstash/redis → uncrypto` ESM chain cannot be parsed by the jest
 * transform in this repo ("Unexpected token 'export'") — same pattern as
 * `emailStudio.test.ts`. The stub mirrors the safe-wrapper's
 * no-op-when-unconfigured behaviour (get → null, set/del → no-op), which is
 * exactly what these pure-helper tests need — production code is untouched.
 */
jest.mock("@/app/lib/db/redis", () => ({
  getRedisClient: () => null,
  __resetRedisForTests: () => {},
  withTimeout: async <T>(p: Promise<T>) => p,
  REDIS_OP_TIMEOUT_MS: 1200,
  redis: {
    get: async <T>() => null as T | null,
    set: async () => {},
    del: async () => 0,
    _getClient: () => null,
    _withTimeout: async <T>(p: Promise<T>) => p,
  },
}));

import { buildBlogUrl, shareBlogLink } from "@/app/lib/services/blogShareService";
import { buildBlogVarContext, renderBlogContent } from "@/app/lib/utils/blogVariables";
import { mergeBlogPostsWithDefaults, getDefaultBlogPosts } from "@/app/lib/utils/blogStore";

describe("blogShareService", () => {
  it("builds an absolute blog URL under /blog", () => {
    expect(buildBlogUrl("welcome-to-along", "https://www.alongng.com")).toBe(
      "https://www.alongng.com/blog/welcome-to-along",
    );
  });

  it("falls back to a relative URL without an origin", () => {
    expect(buildBlogUrl("routing-tips")).toBe("/blog/routing-tips");
  });

  it("never throws when nothing is available", async () => {
    const originalNavigator = global.navigator;
    Object.defineProperty(global, "navigator", { value: {}, configurable: true });
    try {
      const outcome = await shareBlogLink("welcome-to-along", "Welcome");
      expect(typeof outcome.ok).toBe("boolean");
    } finally {
      Object.defineProperty(global, "navigator", { value: originalNavigator, configurable: true });
    }
  });
});

describe("blogVariables", () => {
  it("falls back to guest/traveller for unauthenticated viewers", () => {
    const ctx = buildBlogVarContext({ title: "Hello" }, null);
    expect(ctx.firstName).toBe("traveller");
    expect(ctx.userName).toBe("guest");
    expect(renderBlogContent("<p>Hi {{firstName}}, aka {{userName}}</p>", ctx)).toBe(
      "<p>Hi traveller, aka guest</p>",
    );
  });

  it("uses viewer names when available", () => {
    const ctx = buildBlogVarContext(null, { firstName: "Adaobi", userName: "adaobi" });
    expect(renderBlogContent("<p>Hi {{firstName||traveller}}</p>", ctx)).toContain("Adaobi");
  });

  it("never leaks raw {{identifier}} and never throws on garbage", () => {
    expect(renderBlogContent("<p>{{missingVar}} {{alsoMissing||fallback}}</p>", {})).toBe(
      "<p> fallback</p>",
    );
    expect(() => renderBlogContent("{{{{", {} as Record<string, string>)).not.toThrow();
  });
});

describe("blog defaults merge", () => {
  it("ships hardcoded defaults", () => {
    expect(getDefaultBlogPosts().length).toBeGreaterThan(0);
  });

  it("stored rows win per-slug; defaults backfill", () => {
    const defaults = getDefaultBlogPosts();
    const customised = { ...defaults[0], title: "Admin edited title" };
    const merged = mergeBlogPostsWithDefaults([customised]);
    expect(merged.find((p) => p.slug === customised.slug)?.title).toBe("Admin edited title");
    for (const d of defaults) {
      expect(merged.some((p) => p.slug === d.slug)).toBe(true);
    }
  });
});
