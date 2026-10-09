import {
  PWA_CACHE_VERSION,
  PWA_CACHE_NAMES,
  PWA_PRECACHE_ROUTES,
  PWA_CACHED_DESTINATIONS,
  PWA_NEVER_CACHE_API,
  isNeverCacheApi,
  isCacheableApi,
  isMapTileHost,
  resolvePushPayload,
  PWA_TOAST_COPY,
} from "@/app/lib/config/pwa";

describe("pwa config", () => {
  it("exposes versioned cache names", () => {
    expect(PWA_CACHE_VERSION).toBeTruthy();
    for (const name of Object.values(PWA_CACHE_NAMES)) {
      expect(name).toContain(PWA_CACHE_VERSION);
    }
  });

  it("precaches guest-accessible routes only (incl. offline fallback)", () => {
    expect(PWA_PRECACHE_ROUTES).toContain("/offline.html");
    expect(PWA_PRECACHE_ROUTES).toContain("/home");
    expect(PWA_PRECACHE_ROUTES).toContain("/faq");
    // Auth-gated pages must NOT be precached (would cache login redirects)
    expect(PWA_PRECACHE_ROUTES).not.toContain("/bookmarks");
    expect(PWA_PRECACHE_ROUTES).not.toContain("/notifications");
  });

  it("cached destinations all resolve to precached routes", () => {
    for (const d of PWA_CACHED_DESTINATIONS) {
      expect(PWA_PRECACHE_ROUTES).toContain(d.href);
      expect(d.label).toBeTruthy();
    }
  });

  it("never caches auth/push/admin APIs", () => {
    expect(isNeverCacheApi("/api/auth/me")).toBe(true);
    expect(isNeverCacheApi("/api/push/subscribe")).toBe(true);
    expect(isNeverCacheApi("/api/admin/users")).toBe(true);
    expect(isCacheableApi("/api/auth/me")).toBe(false);
    expect(PWA_NEVER_CACHE_API.length).toBeGreaterThan(0);
  });

  it("caches feed/search/leaderboard GET endpoints", () => {
    expect(isCacheableApi("/api/posts/feed")).toBe(true);
    expect(isCacheableApi("/api/search?q=x")).toBe(true);
    expect(isCacheableApi("/api/leaderboard")).toBe(true);
  });

  it("detects keyless map-tile hosts incl. subdomains", () => {
    expect(isMapTileHost("tiles.openfreemap.org")).toBe(true);
    expect(isMapTileHost("a.tile.openstreetmap.org")).toBe(true);
    expect(isMapTileHost("example.com")).toBe(false);
  });

  it("resolves push payloads for every known type + unknown fallback", () => {
    for (const type of ["LIKE", "COMMENT", "MENTION", "WELCOME", "ROUTE_RESPONSE", "REWARD", "BADGE", "ACCOUNT_DELETION_REQUESTED"]) {
      const p = resolvePushPayload(type, "hello", { postId: "p1" });
      expect(p.title).toBeTruthy();
      expect(p.body).toContain("hello");
      expect(p.url).toBeTruthy();
    }
    const fallback = resolvePushPayload("FUTURE_TYPE", "msg");
    expect(fallback.title).toBeTruthy();
    expect(fallback.url).toBe("/notifications");
  });

  it("has sanitized offline toast copy (no raw error leakage)", () => {
    expect(PWA_TOAST_COPY.wentOffline).not.toMatch(/unexpected token|<\!|an error occurred/i);
    expect(PWA_TOAST_COPY.blockedOffline).toMatch(/offline/i);
    expect(PWA_TOAST_COPY.cachedNotice).toMatch(/refresh/i);
  });
});
