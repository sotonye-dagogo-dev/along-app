/**
 * Site notices (Sprint 75) — maintenance/refresh/announcement normalizers,
 * opaque dark-theme surface, CTA href safety, safe-refresh preservation
 * contract, and config-driven route tag limits.
 */
import {
  SITE_NOTICE_CONFIG,
  normalizeMaintenanceFlag,
  normalizeAnnouncementText,
  normalizeAnnouncements,
  isSafeAnnouncementHref,
} from "@/app/lib/config/siteNotice";
import { SAFE_REFRESH_CONFIG } from "@/app/lib/config/safeRefresh";
import { ROUTE_TAG_CONFIG, parseTagInput } from "@/app/lib/config/routeTags";
import { CREATE_POST_SCHEMA } from "@/app/lib/schemas/post";
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts";

describe("normalizeMaintenanceFlag", () => {
  it("accepts boolean true and the string 'true' only", () => {
    expect(normalizeMaintenanceFlag(true)).toBe(true);
    expect(normalizeMaintenanceFlag("true")).toBe(true);
    expect(normalizeMaintenanceFlag(" True ")).toBe(true);
    expect(normalizeMaintenanceFlag("false")).toBe(false);
    expect(normalizeMaintenanceFlag(false)).toBe(false);
    expect(normalizeMaintenanceFlag(1)).toBe(false);
    expect(normalizeMaintenanceFlag(null)).toBe(false);
    expect(normalizeMaintenanceFlag(undefined)).toBe(false);
  });
});

describe("normalizeAnnouncementText", () => {
  it("strips control chars, collapses whitespace, caps length", () => {
    const ctrl = String.fromCharCode(7);
    expect(normalizeAnnouncementText(`  hello${ctrl}   world  `)).toBe("hello world");
    const long = "x".repeat(600);
    expect(normalizeAnnouncementText(long).length).toBe(
      SITE_NOTICE_CONFIG.announcement.maxChars,
    );
    expect(normalizeAnnouncementText(42)).toBe("");
  });
});

describe("normalizeAnnouncements (rich list with CTA)", () => {
  it("keeps valid entries with optional CTA and generates missing ids", () => {
    const out = normalizeAnnouncements([
      { body: "New routes live!" },
      { id: "second", body: "Check explore", ctaLabel: "Explore", ctaHref: "/explore" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].body).toBe("New routes live!");
    expect(out[0].id.length).toBeGreaterThan(0);
    expect(out[0].ctaLabel).toBeNull();
    expect(out[1].ctaHref).toBe("/explore");
    expect(out[1].ctaLabel).toBe("Explore");
  });

  it("caps list size and body length; drops empty/invalid entries", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ body: `msg ${i}` }));
    expect(normalizeAnnouncements(many)).toHaveLength(
      SITE_NOTICE_CONFIG.announcement.maxItems,
    );
    const withEmpty = normalizeAnnouncements([
      { body: "" },
      { body: "   " },
      null,
      "not-an-object",
      { body: "keep me" },
    ]);
    expect(withEmpty).toHaveLength(1);
    expect(withEmpty[0].body).toBe("keep me");
  });

  it("drops unsafe CTA hrefs (javascript:, protocol-relative, http:)", () => {
    const out = normalizeAnnouncements([
      { body: "a", ctaLabel: "Go", ctaHref: "javascript:alert(1)" },
      { body: "b", ctaLabel: "Go", ctaHref: "//evil.example" },
      { body: "c", ctaLabel: "Go", ctaHref: "http://evil.example" },
      { body: "d", ctaLabel: "Go", ctaHref: "https://alongng.com/blog" },
      { body: "e", ctaLabel: "Go", ctaHref: "/faq" },
    ]);
    expect(out.map((a) => a.ctaHref)).toEqual([
      null,
      null,
      null,
      "https://alongng.com/blog",
      "/faq",
    ]);
  });

  it("requires BOTH label and href for a CTA to render", () => {
    const out = normalizeAnnouncements([
      { body: "a", ctaLabel: "", ctaHref: "/x" },
      { body: "b", ctaLabel: "Go", ctaHref: "" },
      { body: "c", ctaLabel: "Go", ctaHref: "/y" },
    ]);
    // Rendered CTA needs both parts — the banner island checks both.
    expect(out[0].ctaHref).toBeNull();
    expect(out[1].ctaHref).toBeNull();
    expect(out[2].ctaLabel).toBe("Go");
    expect(out[2].ctaHref).toBe("/y");
    const renderedPairs = out.filter((a) => a.ctaLabel && a.ctaHref);
    expect(renderedPairs).toHaveLength(1);
  });

  it("never throws on garbage input", () => {
    expect(normalizeAnnouncements(null)).toEqual([]);
    expect(normalizeAnnouncements("nope")).toEqual([]);
    expect(normalizeAnnouncements({})).toEqual([]);
  });
});

describe("isSafeAnnouncementHref", () => {
  it("accepts internal paths and https URLs only", () => {
    expect(isSafeAnnouncementHref("/explore")).toBe(true);
    expect(isSafeAnnouncementHref("/posts?tag=x#top")).toBe(true);
    expect(isSafeAnnouncementHref("https://alongng.com")).toBe(true);
    expect(isSafeAnnouncementHref("https://")).toBe(false);
    expect(isSafeAnnouncementHref("//cdn.example")).toBe(false);
    expect(isSafeAnnouncementHref("javascript:alert(1)")).toBe(false);
    expect(isSafeAnnouncementHref("http://alongng.com")).toBe(false);
  });
});

describe("maintenance strip surface (opaque dark-theme fix)", () => {
  it("uses the opaque warning-surface token, never a translucent wash", () => {
    expect(SITE_NOTICE_CONFIG.tokens.maintenance.background).toMatch(
      /--color-warning-surface/,
    );
    expect(SITE_NOTICE_CONFIG.tokens.maintenance.background).not.toMatch(
      /rgba|0\.15/,
    );
  });
});

describe("refresh notice config", () => {
  it("ships a boolean SiteConfig key with action copy + i18n keys", () => {
    expect(SITE_NOTICE_CONFIG.siteConfigKeys.refresh).toBe("refreshNotice");
    expect(SITE_NOTICE_CONFIG.copy.refresh.action.length).toBeGreaterThan(0);
    expect(SITE_NOTICE_CONFIG.copy.refresh.body).toMatch(/signed in/i);
    expect(SITE_NOTICE_CONFIG.i18nKeys.refreshAction).toContain("siteNotice.");
  });
});

describe("safe refresh preservation contract", () => {
  it("protects drafts, auth snapshot, and preference keys", () => {
    for (const key of [
      ROUTE_DRAFTS_CONFIG.collectionKey,
      ROUTE_DRAFTS_CONFIG.legacyKey,
      ROUTE_DRAFTS_CONFIG.legacyResponseKey,
      "along-auth-snapshot",
      "along-locale",
      "along-theme",
    ]) {
      expect(SAFE_REFRESH_CONFIG.preserveLocalStorageKeys).toContain(key);
    }
    expect(
      SAFE_REFRESH_CONFIG.preserveLocalStoragePrefixes.some((p) =>
        "along-locale-cache:pcm".startsWith(p),
      ),
    ).toBe(true);
  });
});

describe("route tag config + schema parity", () => {
  it("unifies composers on 10 tags x 30 chars with honest placeholder", () => {
    expect(ROUTE_TAG_CONFIG.maxTags).toBe(10);
    expect(ROUTE_TAG_CONFIG.maxTagLength).toBe(30);
    expect(ROUTE_TAG_CONFIG.placeholder).toMatch(/comma/i);
    expect(ROUTE_TAG_CONFIG.placeholder).toMatch(/Enter/i);
    expect(ROUTE_TAG_CONFIG.placeholder).toMatch(/10/);
    expect(ROUTE_TAG_CONFIG.placeholder).toMatch(/30/);
    expect(ROUTE_TAG_CONFIG.toasts.maxTagsReached.length).toBeGreaterThan(0);
    expect(ROUTE_TAG_CONFIG.toasts.tagTooLong.length).toBeGreaterThan(0);
  });

  it("parseTagInput trims, strips #, lowercases, splits on commas", () => {
    expect(parseTagInput(" #Lagos, Abuja ,, onitsha ")).toEqual([
      "lagos",
      "abuja",
      "onitsha",
    ]);
    expect(parseTagInput("")).toEqual([]);
  });

  it("server schema trims/normalizes tags and rejects over-limit input", () => {
    const ok = CREATE_POST_SCHEMA.safeParse({
      title: "Test route",
      description: "A valid description",
      type: "ROUTE",
      routes: [{ location: "A" }, { location: "B" }],
      tags: ["  lagos  ", "", "#abuja"],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.tags).toEqual(["lagos", "abuja"]);

    const tooMany = CREATE_POST_SCHEMA.safeParse({
      title: "Test route",
      description: "A valid description",
      type: "ROUTE",
      routes: [{ location: "A" }, { location: "B" }],
      tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
    });
    expect(tooMany.success).toBe(false);

    const tooLong = CREATE_POST_SCHEMA.safeParse({
      title: "Test route",
      description: "A valid description",
      type: "ROUTE",
      routes: [{ location: "A" }, { location: "B" }],
      tags: ["x".repeat(31)],
    });
    expect(tooLong.success).toBe(false);

    const boundary = CREATE_POST_SCHEMA.safeParse({
      title: "Test route",
      description: "A valid description",
      type: "ROUTE",
      routes: [{ location: "A" }, { location: "B" }],
      tags: Array.from({ length: 10 }, (_, i) => `${i}`.padEnd(30, "a")),
    });
    expect(boundary.success).toBe(true);
  });
});
