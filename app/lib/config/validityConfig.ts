import type { ValidityConfig } from "@/app/lib/types";

export const DEFAULT_VALIDITY_CONFIG: ValidityConfig = {
  likeRatioWeight: 0.35,
  detailScoreWeight: 0.35,
  similarityRatioWeight: 0.2,
  recencyWeight: 0.1,
  minScoreForVerified: 60,
  minScoreForTrusted: 80,
  cacheTtlSeconds: 1800,
  // Dynamic trust extensions: small, additive, and capped so legacy scores
  // barely move when no community/author signals exist (all sub-scores 0),
  // while followed, verified, long-lived authors with real engagement climb.
  reputationWeight: 0.15,
  engagementWeight: 0.1,
  reportPenaltyWeight: 0.25,
};

/**
 * Corroboration evidence blend — single place to tune what drives the
 * corroboration row of the trust breakdown. All weights are fractions that
 * sum to 1; all scores are 0-100.
 *
 * Corroboration answers "do independent signals agree this route is real?"
 * from four legs:
 * - routeEvidence: another post describing the same corridor (normalized tag
 *   overlap + start/end geo proximity + region match + stop/vehicle/fare
 *   agreement). Scaled by coverage so one matching post counts but three+
 *   count fully.
 * - endorsement: the post's own likes/dislikes relative to views — agreement
 *   readers expressed with actions available on the platform.
 * - responseLinkage: explicit ROUTE_RESPONSE rows quoting this post (or
 *   sharing its request) — somebody rode it and reported back.
 */
export const CORROBORATION_CONFIG = {
  /** Days either side of the post to look for corroborating posts. */
  windowDays: 30,
  /** Max candidate posts scored per evaluation (bounded, cheapest first). */
  maxCandidates: 40,
  /** Minimum pair similarity (0-100) to count a candidate as corroborating. */
  matchThreshold: 30,
  /** Matches needed for full coverage scaling (diminishing beyond). */
  fullCoverageMatches: 3,
  /** Blend weights — must sum to 1. */
  routeEvidenceWeight: 0.55,
  endorsementWeight: 0.25,
  responseWeight: 0.2,
  /** Within routeEvidence: tag vs geo vs route-content split (sums to 1). */
  tagLegWeight: 0.3,
  geoLegWeight: 0.35,
  routeLegWeight: 0.35,
  /** Start/end points within this radius (km) count as "same place". */
  geoRadiusKm: 8,
  /** Fares within this relative band count as agreeing (0.25 = ±25%). */
  fareBandPct: 0.25,
  /** Views divisor: votes/views saturates endorsement confidence. */
  endorsementViewsDivisor: 10,
  /** Votes needed (at zero views) for full endorsement confidence. */
  endorsementVotesForFullConfidence: 10,
  /** Points per explicit response, capped by responseMaxPoints. */
  responsePointsEach: 25,
  responseMaxPoints: 60,
} as const;

/**
 * Bounds for the reputation / engagement / report sub-scores.
 * Kept beside the weights so admins tune trust in one place.
 */
export const VALIDITY_SIGNAL_BOUNDS = {
  /** Followers needed to max out the follower leg of reputation. */
  reputationFollowerSaturation: 500,
  /** Max points the follower leg contributes to reputation (0-100). */
  reputationFollowerMax: 60,
  /** Bonus points for a verified author. */
  reputationVerifiedBonus: 15,
  /** Bonus points for an account older than reputationMatureAgeDays. */
  reputationAgeBonus: 25,
  /** Account age (days) considered fully mature. */
  reputationMatureAgeDays: 180,
  /** Points per comment toward engagement (before the 0-100 cap). */
  engagementPerComment: 6,
  /** Points per bookmark toward engagement (before the 0-100 cap). */
  engagementPerBookmark: 4,
  /** Points per view toward engagement (before the 0-100 cap). */
  engagementPerView: 0.05,
  /** Points per share toward engagement (before the 0-100 cap). */
  engagementPerShare: 3,
  /** Reports needed to max out report pressure (before the 0-100 cap). */
  reportsForMaxPressure: 4,
} as const;

/**
 * Post-richness bonuses for the detail leg of trust (config-driven, pure data).
 *
 * Background: the legacy leg scorer (`computeRouteDetailScore`) only reads
 * per-leg distance/steps/location/description. Composer legs never carry
 * distance/steps, so every text leg scored 15+15=30 → avg 30 × 1.4 = 42 for
 * EVERY post, no matter how many photos, tags, stops or fares it had.
 * These bonuses layer post-level richness (photos, tags, general
 * description, vehicle/fare coverage, stop depth, location coverage) on top
 * of that base, additively and capped, so thin posts keep their legacy
 * score while rich posts climb. All bonuses are 0 when the signal is
 * absent, so callers that pass no context score EXACTLY as before.
 */
export const DETAIL_SCORING_CONFIG = {
  /** Points per photo, up to `maxImageBonus`. */
  perImage: 5,
  maxImageBonus: 20,
  /** Points per tag, up to `maxTagBonus`. */
  perTag: 2,
  maxTagBonus: 10,
  /** General-description length tiers (chars → bonus), first match wins. */
  descriptionTiers: [
    { minLength: 200, bonus: 15 },
    { minLength: 80, bonus: 10 },
    { minLength: 20, bonus: 5 },
  ],
  /** Share of non-destination legs naming a vehicle → scaled to max. */
  maxVehicleBonus: 10,
  /** Share of non-destination legs with a finite fare → scaled to max. */
  maxFareBonus: 10,
  /** Extra stops beyond the first two (start + destination). */
  perExtraStop: 3,
  maxStopBonus: 9,
  /** Share of legs naming a location → scaled to max. */
  maxLocationBonus: 5,
} as const;
