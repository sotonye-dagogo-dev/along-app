import type { LucideIcon } from "lucide-react";

export type VehicleType = "taxi" | "bike" | "keke" | "bus" | "trekking" | "car" | "bolt" | "boat" | "train";

export interface VehicleConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgClass: string;
  textClass: string;
  /**
   * Border pairing for the flag chip (light + dark variants, e.g.
   * "border-yellow-300 dark:border-yellow-800"). Optional so legacy
   * call sites/tests constructing partial configs keep compiling;
   * VehicleChip falls back to no extra border class when absent.
   */
  borderClass?: string;
}

export type RouteStatus = "on-time" | "delayed" | "cancelled" | "diverted" | "unknown";

export interface RouteStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  activeIcon?: LucideIcon;
  roles?: ("user" | "admin" | "USER" | "ADMIN")[];
  section?: "main" | "admin";
}

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "textarea" | "select" | "file" | "number" | "tel";
  placeholder?: string;
  required?: boolean;
  validation?: Record<string, unknown>;
  options?: { label: string; value: string }[];
  icon?: LucideIcon;
}

export interface NotificationTypeConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  messageTemplate: string;
}

export interface FeedAlgorithmConfig {
  followingWeight: number;
  matchingTagsWeight: number;
  trendingWeight: number;
  /**
   * Weight for the viewer's own posts (Sprint 59 inclusion guarantee).
   * Own posts previously surfaced only through the low-weight recent pool
   * (0.15) and could be buried under followed content; scoring them at
   * following-level keeps them visible without excluding anyone else.
   */
  ownPostsWeight: number;
  /**
   * Weight for out-of-network discovery (Sprint 60 inclusion guarantee).
   * The viewer's feed must include posts from users they don't follow:
   * previously such posts surfaced only via the 7-day engagement-ordered
   * trending pool or the tag-match pool, so quiet/older/tag-less posts
   * (notably open route requests, which the suggestions carousel always
   * shows) could never enter the candidate set. Scored below following
   * weight so follow affinity is preserved, but well above trending.
   * Stored SiteConfig `feedAlgorithm` rows merge by spread, so rows written
   * before this knob existed keep working (non-finite guard falls back).
   */
  discoveryWeight: number;
  /**
   * Extra weight for open route requests from non-followed users.
   * Keeps feed parity with the suggestions carousel, which always surfaces
   * recent open requests regardless of follow graph. Additive with
   * discoveryWeight (a request earns both), never a filter — no post is
   * ever excluded for being out-of-network.
   */
  openRequestWeight: number;
  locationBonus: number;
  cacheTtlSeconds: number;
  pageSize: number;
}

export interface QualityCheckpoint {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  weight: number;
  validate: (draft: Record<string, unknown>) => boolean;
}

export interface ValidityConfig {
  likeRatioWeight: number;
  detailScoreWeight: number;
  similarityRatioWeight: number;
  recencyWeight: number;
  minScoreForVerified: number;
  minScoreForTrusted: number;
  cacheTtlSeconds: number;
  // --- Dynamic trust extensions (all optional for backward compatibility;
  // defaults live in DEFAULT_VALIDITY_CONFIG). Reputation + engagement lift
  // credible, lived-in posts; sustained reports drag misleading ones down.
  /** Bonus weight applied to the 0-100 author-reputation sub-score. */
  reputationWeight?: number;
  /** Bonus weight applied to the 0-100 engagement-depth sub-score. */
  engagementWeight?: number;
  /** Penalty weight applied to the 0-100 report-pressure sub-score. */
  reportPenaltyWeight?: number;
}

export interface AvatarConfig {
  style: string;
  seed?: string;
  flip?: boolean;
  backgroundColor?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar?: string;
  socials?: { platform: string; url: string }[];
}

export interface TransportIntegrationConfig {
  provider: string;
  label: string;
  icon: LucideIcon;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
}

export interface PointsAction {
  action: string;
  points: number;
  cooldownHours?: number;
  maxPerDay?: number;
}

export interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}
