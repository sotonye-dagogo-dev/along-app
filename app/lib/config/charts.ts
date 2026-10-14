/**
 * Chart tooltip + analytics metadata.
 *
 * Config-driven: every chart hover tooltip on the platform (admin overview
 * signups line, top-routes bars, user analytics engagement/follower lines,
 * admin analytics charts) renders through `ChartHoverTooltip` using the
 * copy, colours, and formatting rules below — no hardcoded tooltip text in
 * page components.
 */

export const CHART_TOOLTIP_CONFIG = {
  /** Date rendering inside tooltips (config-driven locale + options). */
  dateLocale: "en-US",
  dateOptions: { weekday: "short", month: "short", day: "numeric" } as Intl.DateTimeFormatOptions,
  /** Hide delay keeps the tooltip readable when the pointer grazes a gap. */
  hideDelayMs: 120,
  /** Transparent hit radius (px, SVG units) around line points for touch. */
  hitRadius: 12,
  /** Visible dot radius (px, SVG units). */
  dotRadius: 3.5,
  dotRadiusLast: 4,
  a11yHint: "Hover or focus a data point to see details",
  emptyLabel: "No data for this period",
  /** Fallback copy when a series has no points at the hovered index. */
  noValueLabel: "—",
} as const;

/**
 * Canonical series colours. Pages resolve colours through this registry so
 * Views/Likes/Bookmarks/Signups/Posts/Followers stay identical everywhere
 * (light + dark themes use CSS vars — never hardcoded hex in components).
 */
export const CHART_SERIES_META = {
  series: [
    { id: "views", label: "Views", color: "var(--color-primary)" },
    { id: "likes", label: "Likes", color: "var(--color-error-text)" },
    { id: "bookmarks", label: "Bookmarks", color: "var(--color-info-text)" },
    { id: "signups", label: "Signups", color: "var(--color-primary)" },
    { id: "posts", label: "Posts", color: "var(--color-info-text)" },
    { id: "followers", label: "Followers", color: "var(--color-primary)" },
  ],
  barPalette: [
    "var(--color-primary)",
    "var(--color-warning-border)",
    "var(--color-primary)",
    "var(--color-info-text)",
    "var(--color-warning-border)",
  ],
} as const;

export type ChartSeriesId =
  (typeof CHART_SERIES_META.series)[number]["id"];

/** Resolve a series colour by id; falls back to primary (never throws). */
export function chartSeriesColor(id: string): string {
  try {
    const found = CHART_SERIES_META.series.find((s) => s.id === id);
    return found?.color ?? "var(--color-primary)";
  } catch {
    return "var(--color-primary)";
  }
}

/** Resolve a bar colour by index (cycles the palette, never throws). */
export function chartBarColor(index: number): string {
  try {
    const palette = CHART_SERIES_META.barPalette;
    return palette[index % palette.length];
  } catch {
    return "var(--color-primary)";
  }
}

/** Format an ISO date key (YYYY-MM-DD) for tooltip titles. Null-safe. */
export function formatChartDate(dateKey: unknown): string {
  try {
    if (!dateKey) return CHART_TOOLTIP_CONFIG.noValueLabel;
    const d = new Date(String(dateKey));
    if (Number.isNaN(d.getTime())) return String(dateKey);
    return d.toLocaleDateString(
      CHART_TOOLTIP_CONFIG.dateLocale,
      CHART_TOOLTIP_CONFIG.dateOptions
    );
  } catch {
    return String(dateKey ?? CHART_TOOLTIP_CONFIG.noValueLabel);
  }
}

/** Compact count formatting shared by tooltips (1200 → "1.2K"). Null-safe. */
export function formatChartCount(n: unknown): string {
  // Number(null) === 0 and Number("") === 0 — both must stay "no value",
  // never a misleading zero.
  if (n === null || n === undefined || n === "") {
    return CHART_TOOLTIP_CONFIG.noValueLabel;
  }
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return CHART_TOOLTIP_CONFIG.noValueLabel;
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toLocaleString();
}

export interface ChartTooltipLine {
  label: string;
  value: string | number;
  color?: string;
}

/**
 * Metadata for the dedicated admin analytics page. Sections render in order;
 * each chart card reads title/description/empty-copy from here so copy stays
 * consistent and admin-editable in one place.
 */
export const ADMIN_ANALYTICS_CONFIG = {
  title: "Analytics",
  subtitle: "Platform-wide trends and engagement",
  backHref: "/admin",
  backLabel: "Dashboard",
  periodAriaLabel: "Analytics period",
  refreshLabel: "Refresh",
  retryLabel: "Retry",
  loadError: "Failed to load analytics data",
  kpis: [
    { id: "totalUsers", label: "Total Users", hint: "All accounts ever created" },
    { id: "postsInPeriod", label: "Posts", hint: "Posts created in the selected period" },
    { id: "likesInPeriod", label: "Likes", hint: "Likes given in the selected period" },
    { id: "avgValidity", label: "Avg Validity", hint: "Mean validity score across posts" },
    { id: "openBugs", label: "Open Bugs", hint: "Bug reports not resolved or closed" },
    { id: "signupsInPeriod", label: "New Signups", hint: "Accounts created in the selected period" },
  ],
  sections: [
    {
      id: "growth",
      title: "Signups & posts per day",
      description: "Daily account creations vs routes shared",
      empty: "No activity in this period yet",
      linkHref: "/admin/users",
      linkLabel: "View users",
    },
    {
      id: "engagement",
      title: "Likes per day",
      description: "Community engagement across the period",
      empty: "No likes recorded in this period yet",
      linkHref: "/admin/posts",
      linkLabel: "View posts",
    },
    {
      id: "validity",
      title: "Validity distribution",
      description: "How post quality scores spread across buckets",
      empty: "No scored posts yet",
      linkHref: "/admin/posts",
      linkLabel: "View posts",
    },
    {
      id: "audience",
      title: "Audience breakdown",
      description: "Accounts by role and reward tier",
      empty: "No accounts to break down yet",
      linkHref: "/admin/users",
      linkLabel: "View users",
    },
  ],
  lists: {
    topPostsTitle: "Top routes by validity",
    topPostsLinkHref: "/admin/posts",
    topPostsLinkLabel: "View all",
    topPostsEmpty: "No posts yet",
    topPostsScoreHint: "validity score",
    topContributorsTitle: "Top contributors",
    topContributorsLinkHref: "/admin/users",
    topContributorsLinkLabel: "View all",
    topContributorsEmpty: "No contributors yet",
    topContributorsPostsHint: "posts",
    zeroResultsTitle: "Zero-result queries",
    zeroResultsDescription: "Queries that returned nothing — tune stopwords / fuzzy thresholds from these.",
    zeroResultsEmpty: "No zero-result queries in this period.",
    zeroResultsHint: "Repeated terms here are candidates for stopword removal, synonyms, or a lower fuzzy bar.",
  },
  validityBuckets: [
    { id: "0-20", label: "0–20", min: 0, max: 20 },
    { id: "21-40", label: "21–40", min: 21, max: 40 },
    { id: "41-60", label: "41–60", min: 41, max: 60 },
    { id: "61-80", label: "61–80", min: 61, max: 80 },
    { id: "81-100", label: "81–100", min: 81, max: 100 },
  ],
} as const;

export type AdminAnalyticsKpiId =
  (typeof ADMIN_ANALYTICS_CONFIG.kpis)[number]["id"];
export type AdminAnalyticsSectionId =
  (typeof ADMIN_ANALYTICS_CONFIG.sections)[number]["id"];
