/**
 * Map summary-bar configuration (config-driven, zero app deps).
 *
 * Single source of truth for every "total distance · total time · total
 * fare" bar in the app:
 * - `RouteMap` glass overlay (post detail, live-navigation map, share
 *   preview)
 * - `NavigationGuide` header + live traffic banner
 * - share-route modal preview header
 *
 * Guarantees:
 * - never shows "0 min with traffic" — traffic-adjusted figures render only
 *   when both base and adjusted are finite, positive, and different
 * - distance / duration / fare each hide independently when invalid, so a
 *   missing fare never blanks the whole bar
 * - loading / retrieval states fall back to neutral placeholders instead of
 *   zeros, and all helpers are pure + never-throw
 */

export interface MapSummaryConfig {
  /** Currency symbol prefix for fare chips. */
  currencySymbol: string;
  /** Locale for fare grouping (e.g. 12500 → "12,500"). */
  fareLocale: string;
  /** Decimals for km display in summary bars. */
  distanceDecimals: number;
  /** Placeholder while traffic is still loading. */
  trafficLoadingText: string;
  /** Fallback when no summary value is available. */
  emptyText: string;
  /**
   * Separator for the traffic-aware total range ("62–75 min"): the lower
   * bound is the free-flow base, the upper bound adds the yellow/red delay.
   * Showing the range (not a single figure) is what keeps the header total
   * consistent with the per-stretch times, which always sum to the bounds.
   */
  rangeSeparator: string;
  /**
   * Title tooltip for a ranged total (explains base vs with-traffic).
   * Pure copy — no hardcoded strings in renderers.
   */
  rangeTitle: string;
}

export const MAP_SUMMARY_CONFIG: MapSummaryConfig = {
  currencySymbol: "₦",
  fareLocale: "en-NG",
  distanceDecimals: 1,
  trafficLoadingText: "Calculating traffic…",
  emptyText: "—",
  rangeSeparator: "–",
  rangeTitle: "Free-flow time – with-traffic time for current conditions",
};

/** Finite positive number guard (rejects 0, NaN, Infinity, negatives). */
export function isValidPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Distance guard for summary bars (km). */
export function isValidDistanceKm(value: unknown): value is number {
  return isValidPositiveNumber(value);
}

/** Duration guard for summary bars (minutes). */
export function isValidDurationMins(value: unknown): value is number {
  return isValidPositiveNumber(value);
}

/** Fare guard — zero means "no fare set", so it hides the chip. */
export function isValidFareTotal(value: unknown): value is number {
  return isValidPositiveNumber(value);
}

/**
 * True when a traffic-adjusted duration may be shown alongside the base.
 * Rejects the reported "0 min with traffic (was 1h 6m)" shape: adjusted
 * must be finite + positive and differ from the base, and the base itself
 * must be finite + positive. Loading (null/undefined/0) never passes.
 */
export function shouldShowTrafficAdjusted(
  adjusted: unknown,
  base: unknown
): adjusted is number {
  if (!isValidDurationMins(adjusted)) return false;
  if (!isValidDurationMins(base)) return false;
  return Math.round(adjusted as number) !== Math.round(base as number);
}

/** Format km for summary bars ("12.5km" style is applied by callers). Pure. */
export function formatSummaryDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return MAP_SUMMARY_CONFIG.emptyText;
  if (km >= 1) return `${km.toFixed(MAP_SUMMARY_CONFIG.distanceDecimals)}`;
  return `${Math.round(km * 1000)}m`.replace(/m$/, "");
}

/**
 * Format a traffic-aware total as a range ("62–75 min" / "1h 2m–1h 15m").
 * Single value when traffic matches the base (or is unavailable); pure with
 * the empty-text fallback so loading/zero states hide instead of flashing.
 */
export function formatDurationRange(base: unknown, adjusted: unknown): string {
  const b = typeof base === "number" && Number.isFinite(base) && base > 0 ? Math.round(base) : 0;
  const a = typeof adjusted === "number" && Number.isFinite(adjusted) && adjusted > 0 ? Math.round(adjusted) : 0;
  if (b <= 0) return MAP_SUMMARY_CONFIG.emptyText;
  if (a <= 0 || a === b) return formatSummaryDurationMins(b);
  return `${formatSummaryDurationMins(b)}${MAP_SUMMARY_CONFIG.rangeSeparator}${formatSummaryDurationMins(a)}`;
}

/**
 * Split a minute total across legs by weight (largest-remainder, pure).
 * The returned ints always sum exactly to `total` — this is the consistency
 * contract: per-stretch times add up to the header total instead of drifting
 * by ±1 min per leg from independent rounding.
 */
export function splitMinsByWeights(totalMins: unknown, weights: number[] | null | undefined): number[] {
  if (!Array.isArray(weights) || weights.length === 0) return [];
  if (!Number.isFinite(totalMins as number) || (totalMins as number) <= 0) {
    return weights.map(() => 0);
  }
  const total = Math.round(totalMins as number);
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // No signal — even split keeps the sum contract.
    const each = Math.floor(total / safe.length);
    const out = safe.map(() => each);
    let rest = total - each * safe.length;
    for (let i = 0; rest > 0 && i < out.length; i++, rest--) out[i] += 1;
    return out;
  }
  const exact = safe.map((w) => (total * w) / sum);
  const floored = exact.map((e) => Math.floor(e));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
    .map((o) => o.i);
  const out = [...floored];
  for (const idx of order) {
    if (remainder <= 0) break;
    out[idx] += 1;
    remainder -= 1;
  }
  return out;
}

/** Format minutes for summary bars ("1h 6m" / "45 min"). Pure. */
export function formatSummaryDurationMins(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return MAP_SUMMARY_CONFIG.emptyText;
  const rounded = Math.round(min);
  if (rounded >= 60) {
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${rounded} min`;
}

/** Format a fare total ("₦12,500"). Empty string when invalid so callers hide. */
export function formatFareTotal(amount: unknown): string {
  if (!isValidFareTotal(amount)) return "";
  try {
    const grouped = (amount as number).toLocaleString(MAP_SUMMARY_CONFIG.fareLocale);
    return `${MAP_SUMMARY_CONFIG.currencySymbol}${grouped}`;
  } catch {
    return `${MAP_SUMMARY_CONFIG.currencySymbol}${amount as number}`;
  }
}

/**
 * Remaining share of a route at step `index` of `total` steps (0..1).
 * Step 0 (origin) = full route remaining; final step = 0 remaining.
 * Pure with clamping so navigation stays sane on degenerate step lists.
 */
export function remainingShare(currentIndex: number, totalSteps: number): number {
  if (!Number.isFinite(currentIndex) || !Number.isFinite(totalSteps)) return 1;
  if (totalSteps <= 1) return 0;
  const legs = totalSteps - 1;
  const done = Math.max(0, Math.min(legs, Math.floor(currentIndex)));
  return Math.max(0, Math.min(1, (legs - done) / legs));
}

/** Remaining distance (km, 1 decimal) for the live guide. Pure. */
export function remainingDistanceKm(
  totalKm: unknown,
  currentIndex: number,
  totalSteps: number
): number | null {
  if (!isValidDistanceKm(totalKm)) return null;
  const share = remainingShare(currentIndex, totalSteps);
  if (share <= 0) return 0;
  return Math.round((totalKm as number) * share * 10) / 10;
}

/** Remaining duration (mins, rounded) for the live guide. Pure. */
export function remainingDurationMins(
  totalMins: unknown,
  currentIndex: number,
  totalSteps: number
): number | null {
  if (!isValidDurationMins(totalMins)) return null;
  const share = remainingShare(currentIndex, totalSteps);
  if (share <= 0) return 0;
  return Math.max(0, Math.round((totalMins as number) * share));
}
