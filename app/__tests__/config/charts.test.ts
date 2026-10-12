import {
  CHART_TOOLTIP_CONFIG,
  CHART_SERIES_META,
  ADMIN_ANALYTICS_CONFIG,
  chartSeriesColor,
  chartBarColor,
  formatChartDate,
  formatChartCount,
} from "@/app/lib/config/charts";

describe("chart tooltip + analytics config", () => {
  it("exposes a tooltip behaviour contract (delays, locale, a11y hint)", () => {
    expect(CHART_TOOLTIP_CONFIG.dateLocale).toBe("en-US");
    expect(CHART_TOOLTIP_CONFIG.hideDelayMs).toBeGreaterThan(0);
    expect(CHART_TOOLTIP_CONFIG.a11yHint.length).toBeGreaterThan(0);
    expect(CHART_TOOLTIP_CONFIG.emptyLabel.length).toBeGreaterThan(0);
  });

  it("keeps one canonical colour per series (views/likes/bookmarks/signups/posts/followers)", () => {
    const ids = CHART_SERIES_META.series.map((s) => s.id);
    for (const id of ["views", "likes", "bookmarks", "signups", "posts", "followers"]) {
      expect(ids).toContain(id);
    }
    expect(chartSeriesColor("views")).toBe("var(--color-primary)");
    expect(chartSeriesColor("likes")).toBe("var(--color-error-text)");
    expect(chartSeriesColor("bookmarks")).toBe("var(--color-info-text)");
  });

  it("never throws on unknown series ids or bar indexes", () => {
    expect(chartSeriesColor("unknown-series")).toBe("var(--color-primary)");
    expect(chartSeriesColor("")).toBe("var(--color-primary)");
    expect(chartBarColor(0).length).toBeGreaterThan(0);
    expect(chartBarColor(999).length).toBeGreaterThan(0);
  });

  it("cycles the bar palette instead of going out of bounds", () => {
    const palette = CHART_SERIES_META.barPalette;
    expect(chartBarColor(0)).toBe(palette[0]);
    expect(chartBarColor(palette.length)).toBe(palette[0]);
  });

  it("formats ISO date keys for tooltip titles (null-safe)", () => {
    expect(formatChartDate("2026-10-01").length).toBeGreaterThan(0);
    expect(formatChartDate(null)).toBe(CHART_TOOLTIP_CONFIG.noValueLabel);
    expect(formatChartDate(undefined)).toBe(CHART_TOOLTIP_CONFIG.noValueLabel);
    expect(formatChartDate("not-a-date")).toBe("not-a-date");
  });

  it("formats counts compactly (null-safe)", () => {
    expect(formatChartCount(999)).toBe("999");
    expect(formatChartCount(1500)).toBe("1.5K");
    expect(formatChartCount(null)).toBe(CHART_TOOLTIP_CONFIG.noValueLabel);
    expect(formatChartCount(Number.NaN)).toBe(CHART_TOOLTIP_CONFIG.noValueLabel);
  });

  it("defines a metadata-driven admin analytics page (title, kpis, sections, lists)", () => {
    expect(ADMIN_ANALYTICS_CONFIG.title).toBe("Analytics");
    expect(ADMIN_ANALYTICS_CONFIG.kpis.length).toBeGreaterThanOrEqual(6);
    for (const kpi of ADMIN_ANALYTICS_CONFIG.kpis) {
      expect(kpi.id.length).toBeGreaterThan(0);
      expect(kpi.label.length).toBeGreaterThan(0);
      expect(kpi.hint.length).toBeGreaterThan(0);
    }
    const sectionIds = ADMIN_ANALYTICS_CONFIG.sections.map((s) => s.id);
    for (const id of ["growth", "engagement", "validity", "audience"]) {
      expect(sectionIds).toContain(id);
    }
    for (const section of ADMIN_ANALYTICS_CONFIG.sections) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.empty.length).toBeGreaterThan(0);
      expect(section.linkHref.startsWith("/admin")).toBe(true);
    }
    expect(ADMIN_ANALYTICS_CONFIG.lists.topPostsTitle.length).toBeGreaterThan(0);
    expect(ADMIN_ANALYTICS_CONFIG.lists.topContributorsTitle.length).toBeGreaterThan(0);
  });

  it("covers the full 0–100 validity range with non-overlapping buckets", () => {
    const buckets = ADMIN_ANALYTICS_CONFIG.validityBuckets;
    expect(buckets[0].min).toBe(0);
    expect(buckets[buckets.length - 1].max).toBe(100);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].min).toBeGreaterThan(buckets[i - 1].max);
    }
  });
});
