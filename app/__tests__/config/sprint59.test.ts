/**
 * Sprint 59 — feed inclusion + post-card follow + request labels +
 * route-request FAQ + traffic tightening.
 *
 * - Feed scores the viewer's own posts at following-level (never buried).
 * - Post cards carry a responsive quick-follow affordance (icon on mobile,
 *   text on desktop, hidden when already following / on own posts).
 * - The request-route trigger shows its label inside the button.
 * - Route requests get a dedicated FAQ category (en + pidgin).
 * - Traffic degrades gracefully: (0,0) placeholders stripped, whitespace
 *   keys trimmed, throwing providers fall through to the heuristic.
 */
// NOTE: same ESM-stub discipline as the traffic suite — `@upstash/redis →
// uncrypto` cannot be parsed by the jest transform, so `trafficService`'s
// redis import is stubbed (get → null, set → no-op).
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

import { DEFAULT_FEED_CONFIG } from "@/app/lib/config/feedAlgorithm";
import { POST_FOLLOW_CONFIG } from "@/app/lib/config/postFollow";
import { REQUEST_ROUTE_TRIGGER_CONFIG } from "@/app/lib/config/routeRequest";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";
import { API_REGISTRY } from "@/app/lib/config/apiRegistry";
import { hasTomtomKey } from "@/app/lib/config/traffic";
import {
  getTrafficForRoute,
  stripNullIsland,
} from "@/app/lib/services/trafficService";

describe("feed inclusion (own + non-followed posts)", () => {
  it("scores own posts at following-level by default", () => {
    expect(DEFAULT_FEED_CONFIG.ownPostsWeight).toBe(DEFAULT_FEED_CONFIG.followingWeight);
    expect(Number.isFinite(DEFAULT_FEED_CONFIG.ownPostsWeight)).toBe(true);
    expect(DEFAULT_FEED_CONFIG.ownPostsWeight).toBeGreaterThan(0);
  });
});

describe("post-card follow affordance", () => {
  it("hides on already-followed authors and on own posts (directive preference)", () => {
    expect(POST_FOLLOW_CONFIG.hideWhenFollowing).toBe(true);
    expect(POST_FOLLOW_CONFIG.hideOnOwnPost).toBe(true);
  });

  it("pairs a plus icon (not following) with a checked icon + Follow text", () => {
    expect(POST_FOLLOW_CONFIG.followIcon).toBeTruthy();
    expect(POST_FOLLOW_CONFIG.followingIcon).toBeTruthy();
    expect(POST_FOLLOW_CONFIG.followIcon).not.toBe(POST_FOLLOW_CONFIG.followingIcon);
    expect(POST_FOLLOW_CONFIG.followLabel).toBe("Follow");
    expect(POST_FOLLOW_CONFIG.followingLabel.length).toBeGreaterThan(0);
  });

  it("keeps the mobile icon hidden on desktop and the text hidden on mobile", () => {
    expect(POST_FOLLOW_CONFIG.iconButtonClass).toMatch(/sm:hidden/);
    expect(POST_FOLLOW_CONFIG.textButtonClass).toMatch(/hidden/);
    expect(POST_FOLLOW_CONFIG.textButtonClass).toMatch(/sm:inline-flex/);
  });

  it("builds a status path for the follow-status endpoint", () => {
    expect(POST_FOLLOW_CONFIG.statusPath("abc123")).toBe("/api/users/abc123/follow");
  });

  it("registers GET on the follow endpoint (status checks)", () => {
    expect(API_REGISTRY.usersFollow.methods).toContain("GET");
    expect(API_REGISTRY.usersFollow.methods).toContain("POST");
    expect(API_REGISTRY.usersFollow.methods).toContain("DELETE");
  });
});

describe("request-route trigger labels", () => {
  it("carries a visible full + short label (not just aria)", () => {
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.label).toBe("Request a route");
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.shortLabel).toBe("Request");
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.ariaLabel).toBe("Request a route");
  });

  it("stacks the label below the icon on mobile, beside it on desktop", () => {
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.buttonClass).toMatch(/flex-col/);
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.buttonClass).toMatch(/sm:flex-row/);
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.mobileLabelClass).toMatch(/sm:hidden/);
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.desktopLabelClass).toMatch(/hidden/);
    expect(REQUEST_ROUTE_TRIGGER_CONFIG.desktopLabelClass).toMatch(/sm:inline/);
  });
});

describe("route-request FAQ", () => {
  const wanted = [
    "how-to-request-route",
    "how-to-respond-request",
    "request-tracking",
    "request-vs-route",
    "who-sees-request",
  ];

  it("has a dedicated route-requests category with request/response coverage", () => {
    const cat = DEFAULT_FAQ_ITEMS.find((c) => c.id === "route-requests");
    expect(cat).toBeTruthy();
    const ids = (cat?.items ?? []).map((i) => i.id);
    for (const id of wanted) expect(ids).toContain(id);
    for (const item of cat?.items ?? []) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(20);
    }
  });

  it("ships pidgin translations for every route-request item", () => {
    for (const id of wanted) {
      expect(FAQ_PCM[id]?.question).toBeTruthy();
      expect(FAQ_PCM[id]?.answer).toBeTruthy();
    }
  });
});

describe("traffic tightening (TomTom + legacy maps)", () => {
  const savedTomtom = process.env.TOMTOM_TRAFFIC_KEY;
  const savedMbToken = process.env.MAPBOX_TOKEN;
  const savedMbPublic = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const savedMbAccess = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const restoreEnv = () => {
    if (savedTomtom === undefined) delete process.env.TOMTOM_TRAFFIC_KEY;
    else process.env.TOMTOM_TRAFFIC_KEY = savedTomtom;
    if (savedMbToken === undefined) delete process.env.MAPBOX_TOKEN;
    else process.env.MAPBOX_TOKEN = savedMbToken;
    if (savedMbPublic === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = savedMbPublic;
    if (savedMbAccess === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = savedMbAccess;
  };

  afterEach(restoreEnv);
  afterAll(restoreEnv);

  it("treats whitespace-only keys as unconfigured, trims real ones", () => {
    process.env.TOMTOM_TRAFFIC_KEY = "   ";
    expect(hasTomtomKey()).toBe(false);
    process.env.TOMTOM_TRAFFIC_KEY = "  live-key-123  ";
    expect(hasTomtomKey()).toBe(true);
    delete process.env.TOMTOM_TRAFFIC_KEY;
    expect(hasTomtomKey()).toBe(false);
  });

  it("strips null-island placeholders but keeps real stops", () => {
    const mixed = [
      { lat: 6.5244, lng: 3.3792 },
      { lat: 0, lng: 0 },
      { lat: 6.45, lng: 3.4 },
    ];
    const stripped = stripNullIsland(mixed);
    expect(stripped).toHaveLength(2);
    expect(stripped[0]).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(stripNullIsland([])).toEqual([]);
    expect(stripNullIsland(null as unknown as [])).toEqual([]);
  });

  it("never excludes legacy/degenenerate routes — returns the empty heuristic shape, no throw", async () => {
    const empty = await getTrafficForRoute([], 30);
    expect(empty.provider).toBe("heuristic");
    expect(empty.estimated).toBe(true);
    expect(empty.segments).toEqual([]);

    // All placeholders (pre-traffic legacy row): same graceful shape.
    const nullIsland = await getTrafficForRoute(
      [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0 },
      ],
      30,
    );
    expect(nullIsland.segments).toEqual([]);
    expect(nullIsland.estimated).toBe(true);

    // Single usable stop after stripping: still graceful, still no throw.
    const single = await getTrafficForRoute(
      [
        { lat: 6.5244, lng: 3.3792 },
        { lat: 0, lng: 0 },
      ],
      30,
    );
    expect(single.segments).toEqual([]);
  });

  it("falls back to the keyless heuristic with no keys configured", async () => {
    delete process.env.TOMTOM_TRAFFIC_KEY;
    delete process.env.MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const result = await getTrafficForRoute(
      [
        { lat: 6.5244, lng: 3.3792 },
        { lat: 6.45, lng: 3.4 },
        { lat: 6.6, lng: 3.35 },
      ],
      25,
    );
    expect(result.provider).toBe("heuristic");
    expect(result.estimated).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.baseDurationMins).toBe(25);
  });
});
