/**
 * PWA registry — single source of truth for installability, offline caching,
 * push, and offline UX copy. Zero app deps (config layer only).
 *
 * `public/sw.js` and `public/manifest.json` mirror these values. The service
 * worker is plain JS (no bundler), so it cannot import this file — keep the
 * two in sync and bump PWA_CACHE_VERSION when the precache list changes.
 */

export const PWA_CACHE_VERSION = "v4";

export const PWA_CACHE_NAMES = {
  static: `along-static-${PWA_CACHE_VERSION}`,
  dynamic: `along-dynamic-${PWA_CACHE_VERSION}`,
  api: `along-api-${PWA_CACHE_VERSION}`,
  images: `along-images-${PWA_CACHE_VERSION}`,
  maps: `along-maps-${PWA_CACHE_VERSION}`,
} as const;

/** Cache sizes — bounded so the SW never grows storage unboundedly. */
export const PWA_CACHE_LIMITS = {
  dynamic: 60,
  api: 80,
  images: 120,
  maps: 200,
} as const;

/**
 * App-shell routes precached on install. All are guest-accessible (see
 * middleware.ts guestRoutes) so addAll never fails on auth redirects.
 * Auth-gated pages (/bookmarks, /notifications, …) are runtime-cached instead.
 */
export const PWA_PRECACHE_ROUTES = [
  "/",
  "/home",
  "/explore",
  "/search",
  "/about",
  "/faq",
  "/blog",
  "/manifest.json",
  "/offline.html",
  // Config registry: locale dictionaries are fetched client-side by
  // I18nProvider — precaching them stops raw keys (e.g. guest.signIn)
  // leaking into the UI on first offline load.
  "/locales/en.json",
  "/locales/pcm.json",
] as const;

export const PWA_OFFLINE_FALLBACK = "/offline.html" as const;

/**
 * Cached destinations advertised on the offline fallback page. Every entry
 * must be in PWA_PRECACHE_ROUTES (or reliably runtime-cached) so the links
 * actually resolve while offline.
 */
export const PWA_CACHED_DESTINATIONS = [
  { href: "/home", label: "Home feed", description: "Recently loaded posts" },
  { href: "/explore", label: "Explore", description: "Recently viewed routes" },
  { href: "/search", label: "Search", description: "Recent searches" },
  { href: "/faq", label: "FAQ", description: "Help & offline tips" },
  { href: "/about", label: "About", description: "About Along" },
  { href: "/blog", label: "Blog", description: "Cached articles" },
] as const;

/** API paths the SW must NEVER cache (auth/session integrity). */
export const PWA_NEVER_CACHE_API = [
  "/api/auth/",
  "/api/push/",
  "/api/otp",
  "/api/admin/",
] as const;

/** GET endpoints safe for stale-while-revalidate runtime caching. */
export const PWA_CACHEABLE_API_PREFIXES = [
  "/api/posts/feed",
  "/api/posts/",
  "/api/search",
  "/api/notifications",
  "/api/leaderboard",
  "/api/site-config",
  "/api/config",
  "/api/faq",
  "/api/blog",
  // Approved platform reviews back the About page; GET-only caching is safe
  // (the SW only caches GET — review POSTs always hit the network).
  "/api/reviews",
] as const;

export function isNeverCacheApi(pathname: string): boolean {
  return PWA_NEVER_CACHE_API.some((p) => pathname.startsWith(p));
}

export function isCacheableApi(pathname: string): boolean {
  if (isNeverCacheApi(pathname)) return false;
  return PWA_CACHEABLE_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Map-tile hosts cached runtime-only (opaque, SWR, bounded). */
export const PWA_MAP_TILE_HOSTS = [
  "tiles.openfreemap.org",
  "tile.openstreetmap.org",
  "demotiles.maplibre.org",
  "api.maptiler.com",
] as const;

export function isMapTileHost(hostname: string): boolean {
  return PWA_MAP_TILE_HOSTS.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`),
  );
}

/** Background-sync tags consumed by the SW sync handler. */
export const PWA_SYNC_TAGS = {
  offlineQueue: "along-offline-queue",
} as const;

/** Offline heartbeat — detects captive portals / flaky networks. */
export const PWA_HEARTBEAT = {
  url: "/api/health",
  intervalMs: 30_000,
  timeoutMs: 6_000,
} as const;

export const PWA_TOAST_COPY = {
  wentOffline: "You are offline. Showing cached content — changes will sync when you reconnect.",
  backOnline: "Back online. Refresh to stay updated.",
  blockedOffline: "You are offline. This needs a connection — please try again when back online.",
  cachedNotice: "Cached data shown offline. Refresh when back online to stay updated.",
  // Offline banner collapse/expand (banner must never block interaction).
  collapse: "Minimize",
  expand: "Offline info",
  collapsedLabel: "Offline",
  retry: "Retry",
} as const;

/** Offline banner collapse state (persisted per device, survives reloads). */
export const PWA_OFFLINE_BANNER = {
  storageKey: "along-offline-banner-collapsed",
  /** Start collapsed on small screens where the banner covers the most UI. */
  defaultCollapsed: false,
} as const;

export const PWA_PUSH_DEFAULTS = {
  title: "Along",
  body: "You have a new notification",
  icon: "/icon-192.png",
  badge: "/icon-192.png",
  url: "/notifications",
  tag: "along-notification",
  renotify: false,
} as const;

/**
 * In-app notification type → push payload. Mirrors every in-app type (and
 * every emailed type) so push, in-app, and email stay in lockstep. Non-critical:
 * unknown future types fall back to the generic payload instead of breaking.
 */
export const PWA_PUSH_MIRROR: Record<
  string,
  { title: string; body: (message: string) => string; url: (opts: { postId?: string; commentId?: string }) => string }
> = {
  LIKE: { title: "New like", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  DISLIKE: { title: "New feedback", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  COMMENT: { title: "New comment", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  FOLLOW: { title: "New follower", body: (m) => m, url: () => "/notifications" },
  MENTION: { title: "You were mentioned", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  WELCOME: { title: "Welcome to Along", body: (m) => m, url: () => "/home" },
  ROUTE_REQUEST: { title: "Route request", body: (m) => m, url: () => "/notifications" },
  ROUTE_RESPONSE: { title: "Route response", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  NEW_ROUTE: { title: "New route", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  REWARD: { title: "Reward earned", body: (m) => m, url: () => "/notifications" },
  BADGE: { title: "New badge", body: (m) => m, url: () => "/notifications" },
  VERIFIED: { title: "Route verified", body: (m) => m, url: (o) => (o.postId ? `/posts/${o.postId}` : "/notifications") },
  REPORT: { title: "Report update", body: (m) => m, url: () => "/notifications" },
  MODERATION: { title: "Moderation update", body: (m) => m, url: () => "/notifications" },
  ACCOUNT_DELETION_REQUESTED: { title: "Account deletion requested", body: (m) => m, url: () => "/notifications" },
  ACCOUNT_DELETION_CANCELLED: { title: "Account deletion cancelled", body: (m) => m, url: () => "/notifications" },
  ACCOUNT_DELETION_COMPLETED: { title: "Account deletion completed", body: (m) => m, url: () => "/notifications" },
  // Platform-review thank-you (sent as REWARD in-app; explicit entry keeps
  // push copy stable even though the in-app type is REWARD).
  REVIEW: { title: "Thanks for your review", body: (m) => m, url: () => "/about" },
};

export function resolvePushPayload(
  type: string,
  message: string,
  opts: { postId?: string; commentId?: string } = {},
): { title: string; body: string; url: string } {
  const mirror = PWA_PUSH_MIRROR[type];
  if (!mirror) {
    return {
      title: PWA_PUSH_DEFAULTS.title,
      body: message || PWA_PUSH_DEFAULTS.body,
      url: opts.postId ? `/posts/${opts.postId}` : PWA_PUSH_DEFAULTS.url,
    };
  }
  return { title: mirror.title, body: mirror.body(message), url: mirror.url(opts) };
}
