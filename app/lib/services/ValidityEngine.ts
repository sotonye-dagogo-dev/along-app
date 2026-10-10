import { DEFAULT_VALIDITY_CONFIG, VALIDITY_SIGNAL_BOUNDS } from "@/app/lib/config/validityConfig";

interface ValidityInput {
  likes: number;
  dislikes: number;
  routeDetailScore: number; // 0-100 based on how detailed the route is
  similarityRatio: number;  // 0-100 how unique this is vs other posts
  createdAt: Date;
  // --- Dynamic community/author signals (all optional → backward compatible).
  // When omitted they score 0, so legacy call sites keep their exact scores.
  /** Number of followers the author has. */
  authorFollowerCount?: number;
  /** Whether the author's identity/email is verified. */
  authorVerified?: boolean;
  /** Author account age in days. */
  authorAgeDays?: number;
  /** Denormalised counters that deepen trust beyond raw votes. */
  comments?: number;
  bookmarks?: number;
  views?: number;
  shares?: number;
  /** Open (non-dismissed) reports filed against this post. */
  openReports?: number;
}

interface ValidityResult {
  score: number;
  tier: "low" | "developing" | "verified" | "trusted";
  community: number;
  detail: number;
  corroboration: number;
  recency: number;
  /** 0-100 author reputation (followers + verification + account age). */
  reputation: number;
  /** 0-100 engagement depth (comments + bookmarks + views + shares). */
  engagement: number;
  /** 0-100 report pressure (open reports against this post). */
  reportPressure: number;
}

export type { ValidityInput, ValidityResult };

/** Route leg as stored on Post.routes (tolerant — legacy rows vary). */
interface RouteLegLike {
  distance?: number;
  steps?: unknown[];
  location?: string;
  description?: string;
}

/**
 * Canonical route-detail scorer shared by the create path and the
 * recompute worker. Previously the two disagreed (create used
 * `routes.length * 20`, the worker used distance+steps), so a fresh post
 * flashed an optimistic score (≈37) that the worker then overwrote (≈10).
 * One function → the score is right from the first response.
 */
export function computeRouteDetailScore(routes: unknown): number {
  if (!Array.isArray(routes) || routes.length === 0) return 0;
  const legs = routes as RouteLegLike[];
  const perLeg = legs.map((r) => {
    if (!r || typeof r !== "object") return 0;
    let score = 0;
    if (typeof r.distance === "number" && r.distance > 0) score += 30;
    if (Array.isArray(r.steps) && r.steps.length > 0) score += Math.min(70, r.steps.length * 10);
    // Legs without structured distance/steps still carry signal when they
    // name a place and describe it (composer text legs).
    if (score === 0) {
      if (typeof r.location === "string" && r.location.trim().length > 0) score += 15;
      if (typeof r.description === "string" && r.description.trim().length > 0) score += 15;
    }
    return score;
  });
  const total = perLeg.reduce((sum, s) => sum + s, 0);
  // Average per leg (so 10 thin legs can't outscore 3 rich ones), scaled so
  // a well-described 2-3 stop route lands near 60-100.
  const avg = total / legs.length;
  return Math.min(100, Math.round(avg * 1.4));
}

/** Tag-overlap corroboration: N distinct overlapping posts → N*10, capped. */
export function computeSimilarityRatio(overlappingPostCount: number): number {
  const n = Number.isFinite(overlappingPostCount) ? Math.max(0, overlappingPostCount) : 0;
  return Math.min(100, Math.round(n * 10));
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function computeReputation(input: ValidityInput): number {
  const b = VALIDITY_SIGNAL_BOUNDS;
  const followers = Math.max(0, input.authorFollowerCount ?? 0);
  // Log-scale follower leg: 0→0, ~10→20, ~100→40, saturation→max.
  const followerLeg = followers <= 0
    ? 0
    : Math.min(
        b.reputationFollowerMax,
        (Math.log10(followers + 1) / Math.log10(b.reputationFollowerSaturation + 1)) * b.reputationFollowerMax
      );
  const verifiedLeg = input.authorVerified ? b.reputationVerifiedBonus : 0;
  const ageDays = Math.max(0, input.authorAgeDays ?? 0);
  const ageLeg = Math.min(b.reputationAgeBonus, (ageDays / b.reputationMatureAgeDays) * b.reputationAgeBonus);
  return clamp01to100(followerLeg + verifiedLeg + ageLeg);
}

function computeEngagement(input: ValidityInput): number {
  const b = VALIDITY_SIGNAL_BOUNDS;
  const score =
    Math.max(0, input.comments ?? 0) * b.engagementPerComment +
    Math.max(0, input.bookmarks ?? 0) * b.engagementPerBookmark +
    Math.max(0, input.views ?? 0) * b.engagementPerView +
    Math.max(0, input.shares ?? 0) * b.engagementPerShare;
  return clamp01to100(score);
}

function computeReportPressure(input: ValidityInput): number {
  const open = Math.max(0, input.openReports ?? 0);
  if (open <= 0) return 0;
  return clamp01to100((open / VALIDITY_SIGNAL_BOUNDS.reportsForMaxPressure) * 100);
}

class ValidityEngine {
  async evaluate(input: ValidityInput): Promise<ValidityResult> {
    // Calculate individual components
    const totalInteractions = input.likes + input.dislikes;
    const likeRatio = totalInteractions > 0
      ? (input.likes / totalInteractions) * 100
      : 0;

    const community = Math.round(likeRatio);
    const detail = Math.min(100, input.routeDetailScore);
    const corroboration = Math.min(100, input.similarityRatio);

    // Recency: posts within 24h get 100, decreasing to 0 over 30 days
    const ageMs = Date.now() - new Date(input.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recency = Math.max(0, Math.round(100 - (ageDays / 30) * 100));

    const reputation = computeReputation(input);
    const engagement = computeEngagement(input);
    const reportPressure = computeReportPressure(input);

    const config = DEFAULT_VALIDITY_CONFIG;
    // Base score preserves the legacy 4-signal behaviour exactly; dynamic
    // signals are additive bonuses / penalties so scores stay comparable
    // while becoming genuinely responsive to community + author growth.
    const base = Math.round(
      community * config.likeRatioWeight +
      detail * config.detailScoreWeight +
      corroboration * config.similarityRatioWeight +
      recency * config.recencyWeight
    );
    const dynamic =
      reputation * (config.reputationWeight ?? 0) +
      engagement * (config.engagementWeight ?? 0) -
      reportPressure * (config.reportPenaltyWeight ?? 0);

    const clampedScore = Math.min(100, Math.max(0, Math.round(base + dynamic)));

    let tier: ValidityResult["tier"] = "low";
    if (clampedScore >= config.minScoreForTrusted) tier = "trusted";
    else if (clampedScore >= config.minScoreForVerified) tier = "verified";
    else if (clampedScore >= 30) tier = "developing";

    return { score: clampedScore, tier, community, detail, corroboration, recency, reputation, engagement, reportPressure };
  }

  getTrustLevel(score: number): ValidityResult["tier"] {
    const config = DEFAULT_VALIDITY_CONFIG;
    if (score >= config.minScoreForTrusted) return "trusted";
    if (score >= config.minScoreForVerified) return "verified";
    if (score >= 30) return "developing";
    return "low";
  }
}

export const validityEngine = new ValidityEngine();
