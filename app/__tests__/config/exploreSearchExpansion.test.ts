/**
 * Explore search expansion: routes + users + general posts with suggestions
 * and recents — additive, existing map filter untouched.
 */
import fs from "fs";
import path from "path";
import {
  EXPLORE_SEARCH_CONFIG,
  loadRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
} from "@/app/lib/config/exploreSearch";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("explore search config", () => {
  it("is metadata-driven with sane limits", () => {
    expect(EXPLORE_SEARCH_CONFIG.minChars).toBeGreaterThanOrEqual(2);
    expect(EXPLORE_SEARCH_CONFIG.maxPosts).toBeGreaterThan(0);
    expect(EXPLORE_SEARCH_CONFIG.maxUsers).toBeGreaterThan(0);
    expect(EXPLORE_SEARCH_CONFIG.recentMax).toBeGreaterThan(0);
    expect(EXPLORE_SEARCH_CONFIG.recentKey).toContain("along:");
    expect(EXPLORE_SEARCH_CONFIG.postTypeLabels.ROUTE_REQUEST).toBeTruthy();
  });

  it("recent helpers round-trip newest-first capped (storage-safe)", () => {
    clearRecentSearches();
    expect(loadRecentSearches()).toEqual([]);
    saveRecentSearch("yaba");
    saveRecentSearch("  YABA  ");
    saveRecentSearch("ikeja");
    const recents = loadRecentSearches();
    expect(recents[0]).toBe("ikeja");
    expect(recents.filter((r) => r.toLowerCase() === "yaba")).toHaveLength(1);
    clearRecentSearches();
    expect(loadRecentSearches()).toEqual([]);
  });
});

describe("explore search UI wiring", () => {
  it("ExploreSearchInput fetches unified search without touching the filter", () => {
    const src = read("app/components/features/explore/ExploreSearchInput.tsx");
    expect(src).toContain("/api/search");
    expect(src).toContain("type=all");
    expect(src).toContain("EXPLORE_SEARCH_CONFIG");
    expect(src).toContain("loadRecentSearches");
    expect(src).toContain("saveRecentSearch");
  });

  it("explore page keeps its client filter and adds the suggestion box", () => {
    const src = read("app/(dashboard)/explore/page.tsx");
    expect(src).toContain("ExploreSearchInput");
    expect(src).toContain("handlePickPost");
    // Existing behaviour preserved: text still drives the pin filter.
    expect(src).toContain("filteredPins");
    expect(src).toContain("setSearchQuery");
  });

  it("search API already covers posts+users (no new endpoint needed)", () => {
    const src = read("app/api/search/route.ts");
    expect(src).toContain("posts");
    expect(src).toContain("users");
  });
});
