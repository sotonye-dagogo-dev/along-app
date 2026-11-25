/**
 * Vercel Fluid Active CPU guardrails.
 *
 * Fluid bills actual compute time, so we assert the two things that keep it
 * bounded: background pollers are visibility-aware (no compute in hidden
 * tabs) and public reads / static pages are not blocked from CDN caching by
 * a catch-all Cache-Control. Also pins the feed cache-hit short-circuit that
 * stopped re-scoring live trust on every poll.
 */
import fs from "fs";
import path from "path";
import {
  CLIENT_POLLING_CONFIG,
  PUBLIC_READ_CACHE_CONFIG,
  publicReadCacheControl,
} from "@/app/lib/config/performance";
import { PWA_HEARTBEAT } from "@/app/lib/config/pwa";
import { NOTIFICATION_BADGE_CONFIG } from "@/app/lib/config/navigation";
import { SITE_NOTICE_CONFIG } from "@/app/lib/config/siteNotice";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config/cache";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("client polling policy", () => {
  it("pauses hidden-tab timers and catches up on return", () => {
    expect(CLIENT_POLLING_CONFIG.pauseWhenHidden).toBe(true);
    expect(CLIENT_POLLING_CONFIG.refreshOnVisible).toBe(true);
    expect(CLIENT_POLLING_CONFIG.resumeDelayMs).toBeGreaterThanOrEqual(0);
  });

  it("heartbeat cadence no longer fires every 30s", () => {
    expect(PWA_HEARTBEAT.intervalMs).toBeGreaterThanOrEqual(60_000);
  });

  it("notification badge cadence stays reasonable (>=30s)", () => {
    expect(NOTIFICATION_BADGE_CONFIG.pollMs).toBeGreaterThanOrEqual(30_000);
  });

  it("shared visibility hook gates on document.visibilityState", () => {
    const hook = read("app/lib/hooks/useVisibilityInterval.ts");
    expect(hook).toContain("visibilitychange");
    expect(hook).toContain("pauseWhenHidden");
    expect(hook).toContain("refreshOnVisible");
    expect(hook).toContain("clearInterval");
  });

  it("all background pollers use the shared visibility-aware hook", () => {
    for (const file of [
      "app/lib/hooks/useUnreadNotifications.ts",
      "app/components/ui/SiteNotices.tsx",
      "app/providers/OnlineStatusProvider.tsx",
    ]) {
      expect(read(file)).toContain("useVisibilityInterval");
    }
  });

  it("traffic refresh skips hidden documents", () => {
    expect(read("app/lib/hooks/useRouteTraffic.ts")).toMatch(/document\.hidden/);
  });
});

describe("public read CDN cache policy", () => {
  it("builds a public s-maxage + swr header", () => {
    const header = publicReadCacheControl({ sMaxAgeSec: 30, staleWhileRevalidateSec: 60 });
    expect(header).toBe("public, s-maxage=30, stale-while-revalidate=60");
    expect(header).not.toContain("no-store");
  });

  it("never emits negative cache windows", () => {
    expect(publicReadCacheControl({ sMaxAgeSec: -5, staleWhileRevalidateSec: -1 })).toBe(
      "public, s-maxage=0, stale-while-revalidate=0",
    );
  });

  it("site-config opts into the edge cache", () => {
    expect(PUBLIC_READ_CACHE_CONFIG.siteConfig.sMaxAgeSec).toBeGreaterThan(0);
    const route = read("app/api/site-config/route.ts");
    expect(route).toContain("publicReadCacheControl");
    expect(route).toContain("PUBLIC_READ_CACHE_CONFIG.siteConfig");
  });

  it("next.config does not override caching for every path", () => {
    const nextConfig = read("next.config.mjs");
    const start = nextConfig.indexOf('source: "/:path*"');
    const end = nextConfig.indexOf("source:", start + 'source: "/:path*"'.length);
    const globalBlock = nextConfig.slice(start, end);
    expect(globalBlock).not.toContain('key: "Cache-Control"');
    // Security headers remain on the catch-all path.
    expect(globalBlock).toContain("X-Content-Type-Options");
    // The service worker keeps its deliberate must-revalidate rule.
    expect(nextConfig).toContain('source: "/sw.js"');
  });
});

describe("feed cache-hit CPU short-circuit", () => {
  it("serves the already-enriched cached feed without recomputing trust", () => {
    const source = read("app/lib/services/feedService.ts");
    expect(source).toContain("const enriched =");
    expect(source).toMatch(/if \(enriched\) \{\s*return \{ posts: cached\.posts, nextCursor: cached\.nextCursor \}/);
  });

  it("site notices still poll on the configured cadence", () => {
    expect(SITE_NOTICE_CONFIG.refresh.intervalMs).toBeGreaterThan(0);
  });

  it("guest first-page feed is read-through cached by page size", () => {
    expect(CACHE_TTL.guestFeed).toBeGreaterThan(0);
    expect(CACHE_KEYS.guestFeed(20)).toBe("feed:guest:20");
    expect(CACHE_KEYS.guestFeed(10)).not.toBe(CACHE_KEYS.guestFeed(20));
    const route = read("app/api/posts/feed/route.ts");
    expect(route).toContain("CACHE_KEYS.guestFeed(limit)");
    expect(route).toContain("CACHE_TTL.guestFeed");
  });
});
