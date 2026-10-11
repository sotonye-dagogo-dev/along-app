/**
 * Explore search configuration (config-driven, zero app deps).
 * The explore map keeps its existing client-side pin filter untouched; this
 * registry only drives the additive suggestion dropdown (routes + users +
 * general posts like requests) and the local recent-searches list.
 */

export type ExploreSuggestionKind = "post" | "user" | "tag" | "recent";

export interface ExploreSearchConfig {
  /** Min chars before hitting /api/search for suggestions. */
  minChars: number;
  /** Debounce for suggestion fetches (ms). */
  debounceMs: number;
  /** Max rows per suggestion group. */
  maxPosts: number;
  maxUsers: number;
  maxTags: number;
  /** Recent searches (localStorage). */
  recentKey: string;
  recentMax: number;
  /** Copy. */
  placeholder: string;
  ariaLabel: string;
  suggestionsAriaLabel: string;
  recentTitle: string;
  clearRecentLabel: string;
  emptySuggestionsLabel: string;
  routesGroupLabel: string;
  peopleGroupLabel: string;
  tagsGroupLabel: string;
  recentGroupLabel: string;
  /** Post-type badge labels for suggestion rows. */
  postTypeLabels: Record<string, string>;
}

export const EXPLORE_SEARCH_CONFIG: ExploreSearchConfig = {
  minChars: 2,
  debounceMs: 300,
  maxPosts: 4,
  maxUsers: 3,
  maxTags: 4,
  recentKey: "along:explore-recent-searches",
  recentMax: 6,
  placeholder: "Search routes, places...",
  ariaLabel: "Search routes",
  suggestionsAriaLabel: "Search suggestions",
  recentTitle: "Recent",
  clearRecentLabel: "Clear",
  emptySuggestionsLabel: "No matches — press Enter to filter the map",
  routesGroupLabel: "Routes & requests",
  peopleGroupLabel: "People",
  tagsGroupLabel: "Tags",
  recentGroupLabel: "Recent searches",
  postTypeLabels: {
    ROUTE: "Route",
    ROUTE_REQUEST: "Request",
    ROUTE_RESPONSE: "Response",
  },
};

/** Load recent searches (safe no-throw; newest first). */
export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(EXPLORE_SEARCH_CONFIG.recentKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").slice(0, EXPLORE_SEARCH_CONFIG.recentMax);
  } catch {
    return [];
  }
}

/** Persist a term to recents (dedup, newest-first, capped). */
export function saveRecentSearch(term: string): string[] {
  const clean = term.trim().slice(0, 80);
  if (!clean) {
    try {
      return loadRecentSearches();
    } catch {
      return [];
    }
  }
  try {
    const prev = loadRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase());
    const next = [clean, ...prev].slice(0, EXPLORE_SEARCH_CONFIG.recentMax);
    localStorage.setItem(EXPLORE_SEARCH_CONFIG.recentKey, JSON.stringify(next));
    return next;
  } catch {
    return [clean];
  }
}

/** Clear recents. */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(EXPLORE_SEARCH_CONFIG.recentKey);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
