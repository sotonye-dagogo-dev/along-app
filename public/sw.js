/* Along service worker — offline-first PWA core.
 *
 * Mirrors app/lib/config/pwa.ts (plain JS here: SW has no bundler).
 * Bump CACHE_VERSION there AND below when the precache list changes.
 *
 * Strategies:
 * - Precache app shell (install) — guest-accessible routes only, so install
 *   never fails on auth redirects.
 * - Navigations: network-first, cache-fallback, offline.html fallback.
 * - Cacheable GET /api/*: stale-while-revalidate (bounded). Auth/push/admin
 *   APIs are NEVER cached — session integrity first.
 * - Static assets: cache-first. Images: SWR (bounded). Map tiles (keyless
 *   hosts): SWR opaque (bounded) so maps degrade gracefully offline.
 * - Background sync replays the localStorage offlineQueue (same shape as
 *   app/lib/services/offlineQueue.ts) with credentials included.
 * - Push mirrors every in-app notification; click focuses/opens the URL.
 */

const CACHE_VERSION = "v3";
const STATIC_CACHE = `along-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `along-dynamic-${CACHE_VERSION}`;
const API_CACHE = `along-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `along-images-${CACHE_VERSION}`;
const MAP_CACHE = `along-maps-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE, MAP_CACHE];

const PRECACHE = [
  "/",
  "/home",
  "/explore",
  "/search",
  "/about",
  "/faq",
  "/blog",
  "/manifest.json",
  "/offline.html",
];
const OFFLINE_FALLBACK = "/offline.html";

const NEVER_CACHE_API = ["/api/auth/", "/api/push/", "/api/otp", "/api/admin/"];
const CACHEABLE_API = [
  "/api/posts/feed",
  "/api/posts/",
  "/api/search",
  "/api/notifications",
  "/api/leaderboard",
  "/api/site-config",
  "/api/faq",
  "/api/blog",
];
const MAP_HOSTS = [
  "tiles.openfreemap.org",
  "tile.openstreetmap.org",
  "demotiles.maplibre.org",
  "api.maptiler.com",
];

const LIMITS = { dynamic: 60, api: 80, images: 120, maps: 200 };
const SYNC_TAG = "along-offline-queue";

const PUSH_DEFAULTS = {
  title: "Along",
  body: "You have a new notification",
  icon: "/icon-192.png",
  badge: "/icon-192.png",
  url: "/notifications",
  tag: "along-notification",
};

function isNeverCacheApi(path) {
  return NEVER_CACHE_API.some((p) => path.startsWith(p));
}
function isCacheableApi(path) {
  if (isNeverCacheApi(path)) return false;
  return CACHEABLE_API.some((p) => path.startsWith(p));
}
function isMapHost(hostname) {
  return MAP_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      return trimCache(cacheName, maxItems);
    }
  } catch (_) {
    // quota / private-mode — non-critical
  }
}

function offlineJson() {
  return new Response(
    JSON.stringify({
      error: "Offline",
      message: "You are offline. Showing cached content where available.",
      offline: true,
    }),
    { headers: { "Content-Type": "application/json" }, status: 503 }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (_) {}
      }
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !ALL_CACHES.includes(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol === "chrome-extension:") return;

  const sameOrigin = url.origin === self.location.origin;
  const isNavigate = request.mode === "navigate";

  // Cross-origin map tiles: stale-while-revalidate, opaque allowed, bounded.
  if (!sameOrigin) {
    if (isMapHost(url.hostname)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(MAP_CACHE);
          const cached = await cache.match(request);
          const network = fetch(request)
            .then((res) => {
              if (res && (res.ok || res.type === "opaque")) {
                cache.put(request, res.clone()).catch(() => {});
                trimCache(MAP_CACHE, LIMITS.maps);
              }
              return res;
            })
            .catch(() => cached || Response.error());
          return cached || network;
        })()
      );
    }
    return;
  }

  // API: network-first + cache fallback; never cache auth/push/admin.
  if (url.pathname.startsWith("/api/")) {
    if (isNeverCacheApi(url.pathname)) return; // pass through, no caching
    if (!isCacheableApi(url.pathname)) {
      event.respondWith(fetch(request).catch(() => offlineJson()));
      return;
    }
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res && res.ok) {
            const clone = res.clone();
            const cache = await caches.open(API_CACHE);
            cache.put(request, clone).catch(() => {});
            trimCache(API_CACHE, LIMITS.api);
          }
          return res;
        } catch (_) {
          const cached = await caches.match(request);
          return cached || offlineJson();
        }
      })()
    );
    return;
  }

  // Images: stale-while-revalidate, bounded, SVG placeholder offline.
  if (request.destination === "image") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(request, res.clone()).catch(() => {});
              trimCache(IMAGE_CACHE, LIMITS.images);
            }
            return res;
          })
          .catch(
            () =>
              cached ||
              new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e5e7eb"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="sans-serif">Offline</text></svg>',
                { headers: { "Content-Type": "image/svg+xml" } }
              )
          );
        return cached || network;
      })()
    );
    return;
  }

  // Static assets: cache-first.
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font"
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, res.clone()).catch(() => {});
          }
          return res;
        } catch (_) {
          return new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Pages / navigations: network-first (with preload), cache fallback,
  // offline.html fallback for uncached navigations.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      try {
        const preload = isNavigate
          ? await event.preloadResponse.catch(() => null)
          : null;
        const res = preload || (await fetch(request));
        if (res && res.ok) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(request, res.clone()).catch(() => {});
          trimCache(DYNAMIC_CACHE, LIMITS.dynamic);
        }
        return res;
      } catch (_) {
        if (cached) return cached;
        if (isNavigate) {
          const fallback =
            (await caches.match(OFFLINE_FALLBACK)) ||
            (await caches.match("/offline.html"));
          return fallback || new Response("You are offline", { status: 503 });
        }
        return new Response("Offline", { status: 503 });
      }
    })()
  );
});

// Push — mirrors in-app + emailed notifications. Payload: {title, body, url, tag}.
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      try {
        data = { body: event.data.text() };
      } catch (_) {}
    }
  }
  const title = data.title || PUSH_DEFAULTS.title;
  const body = data.body || PUSH_DEFAULTS.body;
  const targetUrl = data.url || PUSH_DEFAULTS.url;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || PUSH_DEFAULTS.icon,
      badge: data.badge || PUSH_DEFAULTS.badge,
      tag: data.tag || PUSH_DEFAULTS.tag,
      renotify: false,
      vibrate: [200, 100, 200],
      data: { url: targetUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || PUSH_DEFAULTS.url;
  const fullUrl = new URL(targetUrl, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          try {
            const clientUrl = new URL(client.url);
            const target = new URL(fullUrl);
            if (clientUrl.pathname === target.pathname && "focus" in client) {
              return client.focus();
            }
          } catch (_) {}
        }
        if (clients.openWindow) return clients.openWindow(fullUrl);
      })
  );
});

// Background sync — replays the localStorage offlineQueue shape
// {id, endpoint, method, body, createdAt} with credentials included so auth
// cookies travel with the replayed request. Entries that replay OK are
// removed by the client on next load (server-confirmed via flush response).
self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      const clientsList = await clients.matchAll({ includeUncontrolled: true });
      // Ask the foreground page to flush (it owns localStorage access).
      for (const client of clientsList) {
        client.postMessage({ type: "FLUSH_OFFLINE_QUEUE" });
      }
    })()
  );
});
