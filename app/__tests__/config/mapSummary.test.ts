/**
 * @jest-environment jsdom
 *
 * Map summary bars: guards prevent "0 min with traffic", fare formatting,
 * and remaining-share math for the live navigation guide.
 */
import {
  MAP_SUMMARY_CONFIG,
  isValidPositiveNumber,
  isValidDistanceKm,
  isValidDurationMins,
  isValidFareTotal,
  shouldShowTrafficAdjusted,
  formatFareTotal,
  formatSummaryDistanceKm,
  formatSummaryDurationMins,
  remainingShare,
  remainingDistanceKm,
  remainingDurationMins,
} from "@/app/lib/config/mapSummary";

describe("summary guards (nullsafe, never throw)", () => {
  it("rejects zero/NaN/Infinity/negatives", () => {
    expect(isValidPositiveNumber(0)).toBe(false);
    expect(isValidPositiveNumber(NaN)).toBe(false);
    expect(isValidPositiveNumber(Infinity)).toBe(false);
    expect(isValidPositiveNumber(-5)).toBe(false);
    expect(isValidPositiveNumber(12.5)).toBe(true);
    expect(isValidDistanceKm(0)).toBe(false);
    expect(isValidDurationMins(undefined)).toBe(false);
    expect(isValidFareTotal(null)).toBe(false);
  });

  it("never shows traffic-adjusted for loading/zero/equal figures", () => {
    // The reported bug: "0 min with traffic (was 1h 6m)".
    expect(shouldShowTrafficAdjusted(0, 66)).toBe(false);
    expect(shouldShowTrafficAdjusted(null, 66)).toBe(false);
    expect(shouldShowTrafficAdjusted(undefined, 66)).toBe(false);
    expect(shouldShowTrafficAdjusted(66, 66)).toBe(false);
    expect(shouldShowTrafficAdjusted(72, 0)).toBe(false);
    expect(shouldShowTrafficAdjusted(72, 66)).toBe(true);
  });
});

describe("formatting (pure)", () => {
  it("formats fare with currency + grouping, empty when invalid", () => {
    expect(formatFareTotal(12500)).toContain("12,500");
    expect(formatFareTotal(12500).startsWith(MAP_SUMMARY_CONFIG.currencySymbol)).toBe(true);
    expect(formatFareTotal(0)).toBe("");
    expect(formatFareTotal(null)).toBe("");
    expect(formatFareTotal(NaN)).toBe("");
  });

  it("formats durations without zeros", () => {
    expect(formatSummaryDurationMins(66)).toBe("1h 6m");
    expect(formatSummaryDurationMins(60)).toBe("1h");
    expect(formatSummaryDurationMins(45)).toBe("45 min");
    expect(formatSummaryDurationMins(0)).toBe(MAP_SUMMARY_CONFIG.emptyText);
  });

  it("formats distances without zeros", () => {
    expect(formatSummaryDistanceKm(12.5)).toBe("12.5");
    expect(formatSummaryDistanceKm(0)).toBe(MAP_SUMMARY_CONFIG.emptyText);
  });
});

describe("remaining math (dynamic guide)", () => {
  it("origin keeps the full route, destination keeps none", () => {
    expect(remainingShare(0, 5)).toBeCloseTo(1);
    expect(remainingShare(4, 5)).toBe(0);
    expect(remainingShare(2, 5)).toBeCloseTo(0.5);
  });

  it("remaining distance/duration shrink as the user advances", () => {
    const start = remainingDistanceKm(20, 0, 5);
    const mid = remainingDistanceKm(20, 2, 5);
    expect(start).toBe(20);
    expect(mid).toBeLessThan(start as number);
    expect(remainingDurationMins(60, 0, 5)).toBe(60);
    expect(remainingDurationMins(60, 4, 5)).toBe(0);
  });

  it("invalid totals yield null (chip hides, never zero)", () => {
    expect(remainingDistanceKm(0, 0, 5)).toBeNull();
    expect(remainingDurationMins(null, 0, 5)).toBeNull();
  });
});
