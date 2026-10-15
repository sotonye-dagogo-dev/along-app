import type { PointsAction } from "@/app/lib/types";

interface RewardTierConfig {
  label: string;
  minPoints: number;
  color: string;
  icon: string;
}

export const REWARD_TIERS: Record<string, RewardTierConfig> = {
  BRONZE: { label: "Bronze", minPoints: 0, color: "#CD7F32", icon: "Star" },
  SILVER: { label: "Silver", minPoints: 500, color: "#C0C0C0", icon: "Star" },
  GOLD: { label: "Gold", minPoints: 2000, color: "#FFD700", icon: "Award" },
  PLATINUM: { label: "Platinum", minPoints: 5000, color: "#E5E4E2", icon: "Trophy" },
};

export const POINTS_CONFIG: Record<string, PointsAction> = {
  CREATE_POST: { action: "Create route post", points: 50 },
  RECEIVE_LIKE: { action: "Receive a like", points: 5, cooldownHours: 0, maxPerDay: 100 },
  RECEIVE_BOOKMARK: { action: "Receive a bookmark", points: 10, cooldownHours: 0, maxPerDay: 50 },
  INVITE_SENT: { action: "Invite a friend", points: 20 },
  INVITE_ACCEPTED: { action: "Invite accepted", points: 100 },
  VERIFIED_POST: { action: "Post verified", points: 200 },
  DAILY_VISIT: { action: "Daily login", points: 5, cooldownHours: 24 },
};

/**
 * Tier shield display registry — light- AND dark-theme-safe pill classes
 * for the tier shield badges (RewardsPanel pill, AppUserLabel tier icon).
 *
 * Why this exists: the raw tier hues (`REWARD_TIERS.*.color`) include
 * near-white metallics (SILVER #C0C0C0, GOLD #FFD700, PLATINUM #E5E4E2)
 * that are invisible as text/icons on the light card in light theme
 * (and washed out in dark theme). Display classes below pair a saturated
 * `-100` wash + dark `-800`-grade text + matching border in light theme
 * with a `-900/25` wash + `-200` text + `-800` border in dark theme, so
 * the shield pill and its icon always meet WCAG AA against the card.
 * Icons inherit `currentColor` — never the raw metallic hex.
 */
export interface RewardTierDisplay {
  /** Pill classes (bg + text + border, light + dark variants). */
  pillClass: string;
  /** Icon name key (mirrors REWARD_TIERS icon for single-source lookup). */
  icon: string;
}

export const REWARD_TIER_DISPLAY: Record<string, RewardTierDisplay> = {
  BRONZE: {
    pillClass:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
    icon: "Star",
  },
  SILVER: {
    pillClass:
      "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/30 dark:text-slate-200 dark:border-slate-600",
    icon: "Star",
  },
  GOLD: {
    pillClass:
      "bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-900/25 dark:text-yellow-200 dark:border-yellow-800",
    icon: "Award",
  },
  PLATINUM: {
    pillClass:
      "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-600/30 dark:text-gray-100 dark:border-gray-500",
    icon: "Trophy",
  },
};

/** Pill classes for a tier id; unknown tiers fall back to a neutral token pill. */
export function rewardTierPillClass(tier: string): string {
  const found = REWARD_TIER_DISPLAY[String(tier ?? "").toUpperCase()];
  return (
    found?.pillClass ??
    "bg-bg-elevated text-text-secondary border-border"
  );
}
