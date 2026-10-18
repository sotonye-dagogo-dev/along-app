/**
 * Route/request tag limits (config-driven, zero app deps).
 *
 * Single source of truth for how many tags a composer may add, how long
 * each tag may be, and every user-facing hint/toast for the limit. Both
 * share-route and route-request modals read from here (the request form
 * previously capped at 5 — unified to 10, matching the server schema), and
 * the Zod post schema enforces the same numbers as a server backstop.
 */
export interface RouteTagConfig {
  /** Max tags per post/request. */
  maxTags: number;
  /** Max characters per individual tag. */
  maxTagLength: number;
  /** Input placeholder: states comma/Enter input + the limits. */
  placeholder: string;
  /** Label above the tag field. */
  label: string;
  toasts: {
    /** Shown when the user tries to add beyond maxTags. */
    maxTagsReached: string;
    /** Shown when a typed/pasted tag exceeds maxTagLength. */
    tagTooLong: string;
  };
}

export const ROUTE_TAG_CONFIG: RouteTagConfig = {
  maxTags: 10,
  maxTagLength: 30,
  placeholder: "Comma-separated or press Enter to add (max 10 tags, 30 chars each)",
  label: "Tags",
  toasts: {
    maxTagsReached: "Tag limit reached — you can add up to 10 tags",
    tagTooLong: "Tags are limited to 30 characters each",
  },
} as const;

/**
 * Normalize raw composer input into candidate tags: trims, strips a
 * leading `#`, lowercases, and drops empties. Pure — safe for client +
 * server use.
 */
export function parseTagInput(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim().replace(/^#/, "").toLowerCase())
    .filter((part) => part.length > 0);
}
