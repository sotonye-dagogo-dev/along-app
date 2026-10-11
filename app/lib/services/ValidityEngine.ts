import { CORROBORATION_CONFIG, DEFAULT_VALIDITY_CONFIG, VALIDITY_SIGNAL_BOUNDS } from "@/app/lib/config/validityConfig";

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

// ---------------------------------------------------------------------------
// Corroboration evidence scorers (pure, config-driven).
//
// Corroboration answers "do independent signals agree this route is real?"
// from the engagements and actions actually available on the platform:
// likes/dislikes relative to views (endorsement), similar routes from the
// same start to destination with corresponding stops/fares/vehicles (route
// evidence), and explicit ROUTE_RESPONSE linkage (response signal).
// ---------------------------------------------------------------------------

/** Route leg as stored on Post.routes for corroboration (fare/vehicle aware). */
interface CorroborationLegLike {
  location?: string;
  vehicle?: string | null;
  fare?: number | null;
}

/** Minimal post shape the pair scorers need (DB row or list item). */
export interface CorroborationPostLike {
  tags?: string[];
  routes?: unknown;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  region?: string | null;
}

/** Lowercase + trim so `Lagos` and `lagos` corroborate each other. */
export function normalizeCorroborationToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Jaccard overlap of two normalized tag sets → 0-100. Empty/empty → 0. */
export function tagSimilarityScore(tagsA: unknown, tagsB: unknown): number {
  const a = new Set(
    (Array.isArray(tagsA) ? tagsA : []).map(normalizeCorroborationToken).filter(Boolean)
  );
  const b = new Set(
    (Array.isArray(tagsB) ? tagsB : []).map(normalizeCorroborationToken).filter(Boolean)
  );
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  return Math.round((overlap / (a.size + b.size - overlap)) * 100);
}

function toFiniteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Proximity → 0-100: full marks inside the radius, decaying to 0 at 5x. */
function proximityScore(km: number): number {
  const radius = CORROBORATION_CONFIG.geoRadiusKm;
  if (km <= radius) return 100;
  if (km >= radius * 5) return 0;
  return Math.round(((radius * 5 - km) / (radius * 4)) * 100);
}

/**
 * Geo corridor score → 0-100: start proximity (40) + end proximity (40) +
 * region equality (20, normalized). Missing coordinates contribute 0 for
 * that leg rather than failing the whole comparison.
 */
export function geoCorridorScore(a: CorroborationPostLike, b: CorroborationPostLike): number {
  let score = 0;
  const aStartLat = toFiniteOrNull(a?.startLat);
  const aStartLng = toFiniteOrNull(a?.startLng);
  const bStartLat = toFiniteOrNull(b?.startLat);
  const bStartLng = toFiniteOrNull(b?.startLng);
  if (aStartLat !== null && aStartLng !== null && bStartLat !== null && bStartLng !== null) {
    score += 0.4 * proximityScore(haversineKm(aStartLat, aStartLng, bStartLat, bStartLng));
  }
  const aEndLat = toFiniteOrNull(a?.endLat);
  const aEndLng = toFiniteOrNull(a?.endLng);
  const bEndLat = toFiniteOrNull(b?.endLat);
  const bEndLng = toFiniteOrNull(b?.endLng);
  if (aEndLat !== null && aEndLng !== null && bEndLat !== null && bEndLng !== null) {
    score += 0.4 * proximityScore(haversineKm(aEndLat, aEndLng, bEndLat, bEndLng));
  }
  const aRegion = normalizeCorroborationToken(a?.region);
  const bRegion = normalizeCorroborationToken(b?.region);
  if (aRegion && bRegion && aRegion === bRegion) score += 20;
  return Math.min(100, Math.round(score));
}

function routeLegs(routes: unknown): CorroborationLegLike[] {
  if (!Array.isArray(routes)) return [];
  return routes.filter((r): r is CorroborationLegLike => !!r && typeof r === "object");
}

/** Non-destination legs only — the final stop has no onward fare/vehicle. */
function transitLegs(routes: unknown): CorroborationLegLike[] {
  const legs = routeLegs(routes);
  return legs.length > 1 ? legs.slice(0, -1) : legs;
}

function stopNameSet(routes: unknown): Set<string> {
  const names = new Set<string>();
  for (const leg of routeLegs(routes)) {
    const name = normalizeCorroborationToken(leg.location);
    if (name) names.add(name);
  }
  return names;
}

/**
 * Route-content score → 0-100: stop-name overlap (50) + vehicle agreement
 * (25) + fare-band agreement (25). Destination legs are excluded from the
 * vehicle/fare legs per the platform's destination convention. Empty/empty
 * vehicle or fare sets are neutral (50 for that leg) — unspecified is not
 * disagreement.
 */
export function routeContentScore(routesA: unknown, routesB: unknown): number {
  const stopsA = stopNameSet(routesA);
  const stopsB = stopNameSet(routesB);
  let stopScore = 0;
  if (stopsA.size > 0 && stopsB.size > 0) {
    let overlap = 0;
    for (const s of stopsA) if (stopsB.has(s)) overlap++;
    stopScore = (overlap / (stopsA.size + stopsB.size - overlap)) * 100;
  }

  const vehiclesOf = (routes: unknown): Set<string> => {
    const out = new Set<string>();
    for (const leg of transitLegs(routes)) {
      const v = normalizeCorroborationToken(leg.vehicle);
      if (v) out.add(v);
    }
    return out;
  };
  const vA = vehiclesOf(routesA);
  const vB = vehiclesOf(routesB);
  let vehicleScore = 50;
  if (vA.size > 0 && vB.size > 0) {
    let overlap = 0;
    for (const v of vA) if (vB.has(v)) overlap++;
    vehicleScore = (overlap / (vA.size + vB.size - overlap)) * 100;
  }

  const faresOf = (routes: unknown): number[] =>
    transitLegs(routes)
      .map((leg) => (typeof leg.fare === "number" && Number.isFinite(leg.fare) ? leg.fare : null))
      .filter((f): f is number => f !== null);
  const fA = faresOf(routesA);
  const fB = faresOf(routesB);
  let fareScore = 50;
  if (fA.length > 0 && fB.length > 0) {
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const mA = mean(fA);
    const mB = mean(fB);
    if (mA === 0 && mB === 0) {
      fareScore = 100;
    } else {
      const denom = Math.max(Math.abs(mA), Math.abs(mB), 1);
      const diff = Math.abs(mA - mB) / denom;
      fareScore = diff <= CORROBORATION_CONFIG.fareBandPct
        ? 100
        : Math.max(0, Math.round(100 * (1 - diff)));
    }
  }

  return Math.min(100, Math.round(stopScore * 0.5 + vehicleScore * 0.25 + fareScore * 0.25));
}

/**
 * Pair similarity → 0-100: normalized tag Jaccard + geo corridor + route
 * content, blended with CORROBORATION_CONFIG leg weights.
 */
export function pairSimilarityScore(a: CorroborationPostLike, b: CorroborationPostLike): number {
  const c = CORROBORATION_CONFIG;
  const score =
    tagSimilarityScore(a?.tags, b?.tags) * c.tagLegWeight +
    geoCorridorScore(a, b) * c.geoLegWeight +
    routeContentScore(a?.routes, b?.routes) * c.routeLegWeight;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Endorsement → 0-100: approval ratio (likes vs dislikes) scaled by
 * confidence from vote volume relative to views. A couple of likes on a
 * low-view post already register (no more permanent zero); confidence
 * saturates as votes accumulate.
 */
export function endorsementScore(input: { likes: number; dislikes: number; views: number }): number {
  const likes = Math.max(0, Math.floor(Number(input?.likes) || 0));
  const dislikes = Math.max(0, Math.floor(Number(input?.dislikes) || 0));
  const views = Math.max(0, Math.floor(Number(input?.views) || 0));
  const votes = likes + dislikes;
  if (votes <= 0) return 0;
  const c = CORROBORATION_CONFIG;
  const approval = likes / votes;
  const confidenceDenominator = Math.max(
    c.endorsementVotesForFullConfidence,
    views / c.endorsementViewsDivisor + 1
  );
  const confidence = Math.min(1, votes / confidenceDenominator);
  return Math.min(100, Math.max(0, Math.round(approval * confidence * 100)));
}

/**
 * Final corroboration → 0-100 from the three evidence legs. Route evidence
 * (best pair similarity) scales with coverage so a single matching post
 * counts but `fullCoverageMatches` count fully; explicit responses add up
 * to `responseMaxPoints` before blending.
 */
export function computeCorroborationScore(input: {
  bestSimilarity: number;
  matchCount: number;
  endorsement: number;
  responseCount: number;
}): number {
  const c = CORROBORATION_CONFIG;
  const best = Math.min(100, Math.max(0, Number(input?.bestSimilarity) || 0));
  const matches = Math.max(0, Math.floor(Number(input?.matchCount) || 0));
  const endorsement = Math.min(100, Math.max(0, Number(input?.endorsement) || 0));
  const responses = Math.max(0, Math.floor(Number(input?.responseCount) || 0));
  const coverage = matches <= 0 ? 0 : Math.min(1, 0.5 + (0.5 * matches) / c.fullCoverageMatches);
  const routeEvidence = best * coverage;
  const responseSignal = Math.min(c.responseMaxPoints, responses * c.responsePointsEach);
  const blended =
    routeEvidence * c.routeEvidenceWeight +
    endorsement * c.endorsementWeight +
    responseSignal * c.responseWeight;
  return Math.min(100, Math.max(0, Math.round(blended)));
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
