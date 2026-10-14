import { STUDIO_LAYOUT_CONFIG, studioPreviewStyle, avatarGridStyle } from "@/app/lib/config/studioLayout";
import {
  FEED_DIVERSITY_CONFIG,
  normalizeFeedDiversityConfig,
  validateFeedDiversityConfigValue,
} from "@/app/lib/config/feedAlgorithm";
import {
  SEARCH_ANALYTICS_CONFIG,
  normalizeAnalyticsQuery,
  buildZeroResultPayload,
  tokenizeSearchQuery,
} from "@/app/lib/config/search";
import { htmlToBlocks, blocksToBlogHtml } from "@/app/lib/utils/emailBuilder";

describe("studio tightening (directive)", () => {
  it("studio layout is generous + viewport-capped", () => {
    expect(STUDIO_LAYOUT_CONFIG.emailPreviewMaxHeight).toMatch(/78vh/);
    expect(STUDIO_LAYOUT_CONFIG.blogPreviewMaxHeight).toMatch(/78vh/);
    expect(STUDIO_LAYOUT_CONFIG.previewStickyClass).toMatch(/sticky/);
    expect(STUDIO_LAYOUT_CONFIG.previewStickyClass).toMatch(/self-start/);
    const style = studioPreviewStyle(STUDIO_LAYOUT_CONFIG.blogPreviewMaxHeight, 360);
    expect(style.overflow).toBe("auto");
    expect(String(style.maxHeight)).toMatch(/78vh/);
    const grid = avatarGridStyle();
    expect(grid.overflowY).toBe("auto");
  });

  it("feed diversity normalize/validate never throws and clamps", () => {
    expect(normalizeFeedDiversityConfig(undefined)).toEqual(FEED_DIVERSITY_CONFIG);
    expect(normalizeFeedDiversityConfig({ maxConsecutiveFromSameAuthor: 0 }).maxConsecutiveFromSameAuthor).toBe(1);
    expect(normalizeFeedDiversityConfig({ jitterWeight: -1 }).jitterWeight).toBe(FEED_DIVERSITY_CONFIG.jitterWeight);
    expect(validateFeedDiversityConfigValue({ maxConsecutiveFromSameAuthor: 2, lookaheadWindow: 8, jitterWeight: 0.02 })).toBeNull();
    expect(validateFeedDiversityConfigValue({ maxConsecutiveFromSameAuthor: 0 })).toMatch(/maxConsecutive/);
    expect(validateFeedDiversityConfigValue("nope")).not.toBeNull();
  });

  it("zero-result analytics helpers are pure + capped", () => {
    expect(SEARCH_ANALYTICS_CONFIG.eventName).toBe("search_zero_results");
    expect(normalizeAnalyticsQuery("  Lekki TO Ajah  ")).toBe("lekki to ajah");
    expect(normalizeAnalyticsQuery("")).toBe("");
    const tokenized = tokenizeSearchQuery("Lekki to Ajah");
    const payload = buildZeroResultPayload("Lekki to Ajah", tokenized, { type: "all" });
    expect(payload.query).toBe("lekki to ajah");
    expect(payload.terms).toContain("lekki");
    expect(payload.type).toBe("all");
    expect(buildZeroResultPayload(null, null, null).query).toBe("");
  });

  it("blog CTA round-trips button blocks (no link degradation)", () => {
    const html = blocksToBlogHtml([{ id: "1", type: "button", text: "Open Along", url: "/home" }]);
    expect(html).toContain("blog-cta");
    const back = htmlToBlocks(html);
    expect(back.some((b) => b.type === "button")).toBe(true);
  });
});
