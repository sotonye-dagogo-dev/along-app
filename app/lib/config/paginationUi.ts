/**
 * Pagination-UI configuration (config-driven, zero app deps).
 *
 * Two complementary controls, both non-breaking over the existing APIs:
 * - Cursor-model APIs (notifications, search, comments, admin lists, reviews)
 *   keep cursor pagination (per the cursor-pagination decision) and gain a
 *   `ViewMoreButton`: "View more" appends the next cursor; the result count
 *   line tells users where they are. No prev/specific-page retrofit — cursor
 *   windows are unstable under concurrent writes by design.
 * - Page-model APIs (leaderboard, blog) keep ?page=&limit= and gain a shared
 *   `PageNavigator` (prev / specific numbers with ellipsis / next + jump to a
 *   labelled rank such as "my rank" where the surface supports it).
 */

export interface PaginationUiConfig {
  viewMore: {
    /** Default label for the append-next-cursor button. */
    label: string;
    /** Loading label while the next window fetches. */
    loadingLabel: string;
    /** "Showing X of Y…" line builder (null total → open-ended copy). */
    countLine: (shown: number, total: number | null) => string;
  };
  navigator: {
    prevLabel: string;
    nextLabel: string;
    pageLabel: (page: number, totalPages: number) => string;
  };
}

export const PAGINATION_UI_CONFIG: PaginationUiConfig = {
  viewMore: {
    label: "View more",
    loadingLabel: "Loading more…",
    countLine: (shown, total) =>
      total === null
        ? `Showing ${shown} so far`
        : `Showing ${shown} of ${total}`,
  },
  navigator: {
    prevLabel: "Previous page",
    nextLabel: "Next page",
    pageLabel: (page, totalPages) => `Page ${page} of ${totalPages}`,
  },
};
