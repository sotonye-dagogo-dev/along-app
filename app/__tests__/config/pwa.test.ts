import {
  PWA_CACHE_VERSION,
  PWA_CACHE_NAMES,
  PWA_PRECACHE_ROUTES,
  PWA_CACHED_DESTINATIONS,
  PWA_NEVER_CACHE_API,
  PWA_OFFLINE_BANNER,
  PWA_INSTALL_CONFIG,
  PWA_UPDATE_CONFIG,
  PWA_SW_MESSAGES,
  isStandaloneDisplay,
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

  it("precaches the config registry (locale dictionaries) so no raw keys leak offline", () => {
    expect(PWA_PRECACHE_ROUTES).toContain("/locales/en.json");
    expect(PWA_PRECACHE_ROUTES).toContain("/locales/pcm.json");
  });

  it("caches config-registry + reviews GET endpoints", () => {
    expect(isCacheableApi("/api/site-config?key=x")).toBe(true);
    expect(isCacheableApi("/api/config")).toBe(true);
    expect(isCacheableApi("/api/reviews?limit=20")).toBe(true);
  });

  it("exposes collapsible offline-banner copy + storage key", () => {
    expect(PWA_TOAST_COPY.collapse).toBeTruthy();
    expect(PWA_TOAST_COPY.expand).toBeTruthy();
    expect(PWA_TOAST_COPY.collapsedLabel).toBeTruthy();
    expect(PWA_OFFLINE_BANNER.storageKey).toBeTruthy();
  });

  it("resolves a REVIEW push payload (thank-you mirror)", () => {
    const p = resolvePushPayload("REVIEW", "Thanks for reviewing Along!");
    expect(p.title).toMatch(/review/i);
    expect(p.body).toContain("Thanks for reviewing Along!");
    expect(p.url).toBe("/about");
  });
  it("has sanitized offline toast copy (no raw error leakage)", () => {
    expect(PWA_TOAST_COPY.wentOffline).not.toMatch(/unexpected token|<\!|an error occurred/i);
    expect(PWA_TOAST_COPY.blockedOffline).toMatch(/offline/i);
    expect(PWA_TOAST_COPY.cachedNotice).toMatch(/refresh/i);
  });

  it("exposes a config-driven install registry (local flags, TTL, copy)", () => {
    expect(PWA_INSTALL_CONFIG.storage.installedKey).toBe("along-pwa-installed");
    expect(PWA_INSTALL_CONFIG.storage.dismissedAtKey).toBe("along-pwa-dismissed-at");
    expect(PWA_INSTALL_CONFIG.storage.dismissTtlMs).toBeGreaterThan(0);
    for (const k of ["title", "body", "install", "later", "iosHelp", "manualHelp"] as const) {
      expect(PWA_INSTALL_CONFIG.copy[k].length).toBeGreaterThan(0);
    }
  });

  it("isStandaloneDisplay never throws and returns false without a window match", () => {
    expect(() => isStandaloneDisplay()).not.toThrow();
    expect(isStandaloneDisplay()).toBe(false);
  });

  it("exposes a config-driven SW update registry (interval, event, TTL, copy)", () => {
    expect(PWA_UPDATE_CONFIG.checkIntervalMs).toBeGreaterThan(0);
    expect(PWA_UPDATE_CONFIG.checkOnVisible).toBe(true);
    expect(PWA_UPDATE_CONFIG.checkOnOnline).toBe(true);
    expect(PWA_UPDATE_CONFIG.updateReadyEvent).toBe("along:sw-update-ready");
    expect(PWA_UPDATE_CONFIG.storage.reloadedKey).toBeTruthy();
    expect(PWA_UPDATE_CONFIG.storage.dismissedAtKey).toBeTruthy();
    expect(PWA_UPDATE_CONFIG.storage.dismissTtlMs).toBeGreaterThan(0);
    for (const k of ["title", "body", "update", "later", "updatedToast"] as const) {
      expect(PWA_UPDATE_CONFIG.copy[k].length).toBeGreaterThan(0);
    }
  });

  it("exposes a stable client-SW message vocabulary (prompt flow, no force-reload)", () => {
    expect(PWA_SW_MESSAGES.skipWaiting).toBe("SKIP_WAITING");
    expect(PWA_SW_MESSAGES.updateReady).toBeTruthy();
    expect(PWA_SW_MESSAGES.activated).toBeTruthy();
    expect(PWA_SW_MESSAGES.getVersion).toBeTruthy();
    expect(PWA_SW_MESSAGES.version).toBeTruthy();
  });
});
