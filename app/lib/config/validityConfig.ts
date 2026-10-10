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
