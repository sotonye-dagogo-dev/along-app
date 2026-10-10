import { DEFAULT_VALIDITY_CONFIG } from "./validityConfig";

/**
 * Trust breakdown display registry — single source of truth for which rows
 * the TrustBadge tooltip renders on each surface.
 *
 * The engine always computes the SAME six components for every post
 * (see trustBreakdownService). Feed cards render the compact subset while
 * the post detail renders the full set — but the shared values are
 * identical because both surfaces read the same `validityBreakdown` object.
 * Fewer rows on the card never means different numbers.
 */
export const TRUST_BREAKDOWN_KEYS = [
  "community",
  "detail",
  "corroboration",
  "recency",
  "reputation",
  "engagement",
] as const;

export type TrustBreakdownKey = (typeof TRUST_BREAKDOWN_KEYS)[number];

export const TRUST_BREAKDOWN_LABELS: Record<TrustBreakdownKey, string> = {
  community: "Community",
  detail: "Detail",
  corroboration: "Corroboration",
  recency: "Recency",
  reputation: "Reputation",
  engagement: "Engagement",
};

export const TRUST_DISPLAY_CONFIG = {
  /** Rows shown on compact surfaces (feed PostCard, explore, search). */
  compactKeys: ["community", "detail", "corroboration", "recency"] as TrustBreakdownKey[],
  /** Rows shown on full surfaces (post detail). Values are identical. */
  fullKeys: [...TRUST_BREAKDOWN_KEYS] as TrustBreakdownKey[],
  labels: TRUST_BREAKDOWN_LABELS,
} as const;

export type TrustDisplayVariant = "compact" | "full";

export function trustKeysForVariant(variant: TrustDisplayVariant): readonly TrustBreakdownKey[] {
  return variant === "compact" ? TRUST_DISPLAY_CONFIG.compactKeys : TRUST_DISPLAY_CONFIG.fullKeys;
}

/**
 * Canonical tier derivation shared by every TrustBadge instance. When a live
 * breakdown ships a fresh `score`, the badge label is re-derived from that
 * score so the number and the label can never disagree (previously the
 * stored tier + live components could tell two stories at once).
 */
export function trustTierForScore(score: number): "low" | "developing" | "verified" | "trusted" {
  const s = Number.isFinite(score) ? Math.round(score) : 0;
  if (s >= DEFAULT_VALIDITY_CONFIG.minScoreForTrusted) return "trusted";
  if (s >= DEFAULT_VALIDITY_CONFIG.minScoreForVerified) return "verified";
  if (s >= 30) return "developing";
  return "low";
}
