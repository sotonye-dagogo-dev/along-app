export interface SiteReview {
  quote: string;
  initials: string;
  name: string;
  handle: string;
  bg: string;
  color: string;
  stars: number;
}

/** Testimonials shown on the About page. */
export const SITE_REVIEWS: SiteReview[] = [  {
    quote: "\"Along saved me 40 minutes on my daily commute to VI. The Keke + Bus route nobody knew about is now my go-to.\"",
    initials: "FM",
    name: "Fatima Mohammed",
    handle: "@fatima_commutes",
    bg: "bg-primary-muted",
    color: "text-primary",
    stars: 5,
  },
  {
    quote: "\"The Trust system is a game-changer. I can see which routes are actually used every day vs. someone's one-time shortcut.\"",
    initials: "EK",
    name: "Emeka Kalu",
    handle: "@emeka_routes",
    bg: "bg-info",
    color: "text-info-text",
    stars: 5,
  },
  {
    quote: "\"I discovered that taking a Keke from my street to the BRT stop saves \u20A6200 and 10 minutes. Along changed how I move.\"",
    initials: "AJ",
    name: "Aisha Jibril",
    handle: "@aisha_travels",
    bg: "bg-warning",
    color: "text-warning-text",
    stars: 5,
  },
];

/**
 * Platform-reviews registry — single source of truth for the user-facing
 * reviews flow (profile Reviews tab, About carousel, moderation).
 *
 * Storage model (non-breaking, no migration): platform reviews reuse the
 * `UserReview` table with `reviewerId === revieweeId === authorId`
 * (self-pair marker). The `@@unique([reviewerId, revieweeId])` constraint
 * then naturally enforces one platform review per user (re-submit = update).
 * Genuine user-to-user reviewing remains unimplemented, as before.
 */
export const REVIEWS_CONFIG = {
  minRating: 1,
  maxRating: 5,
  maxCommentLength: 1000,
  listLimit: 20,
  maxListLimit: 50,
  /** CTA panel cadence inside the About reviews carousel. */
  ctaEvery: 10,
  /** Below this count the CTA sits once at the end; below `ctaEvery * 2`
   *  it sits at the midpoint instead (e.g. 14 → after 7; 11 → after 5). */
  ctaMidpointThreshold: 20,
  /** Initial rating preselected in the review form (0 = none). */
  defaultRating: 0,
} as const;

export interface PlatformReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewer: { id: string; firstName: string; lastName: string; userName: string; avatar: string | null };
}

/** Null-safe display name — anonymized (deleted/archived) authors render as
 *  "Deleted User" instead of crashing admin/user surfaces. */
export function reviewAuthorName(
  reviewer: { firstName?: string | null; lastName?: string | null; userName?: string | null } | null | undefined,
): string {
  const full = `${reviewer?.firstName ?? ""} ${reviewer?.lastName ?? ""}`.trim();
  if (full) return full;
  if (reviewer?.userName) return `@${reviewer.userName}`;
  return "Deleted User";
}

export type ReviewStreamEntry<T> = { kind: "review"; review: T } | { kind: "cta" };

/**
 * Interleaves CTA panels into an ordered review list per the product rule:
 * - n <= 10 → single CTA at the end (also covers n === 0: CTA only).
 * - 10 < n < 20 → single CTA at the midpoint (floor(n / 2)).
 * - n >= 20 → CTA after every 10 reviews (never trailing when n % 10 === 0…
 *   actually trailing is fine/desired: the panel closes the tape).
 * Pure function — unit-tested, reused by the About carousel (and any future
 * review tape) so the cadence can't drift between surfaces.
 */
export function insertReviewCtaPanels<T>(reviews: T[]): ReviewStreamEntry<T>[] {
  const n = reviews.length;
  const out: ReviewStreamEntry<T>[] = [];
  if (n === 0) return [{ kind: "cta" }];
  if (n <= REVIEWS_CONFIG.ctaEvery) {
    for (const r of reviews) out.push({ kind: "review", review: r });
    out.push({ kind: "cta" });
    return out;
  }
  if (n < REVIEWS_CONFIG.ctaMidpointThreshold) {
    const mid = Math.floor(n / 2);
    reviews.forEach((r, i) => {
      out.push({ kind: "review", review: r });
      if (i + 1 === mid) out.push({ kind: "cta" });
    });
    return out;
  }
  reviews.forEach((r, i) => {
    out.push({ kind: "review", review: r });
    if ((i + 1) % REVIEWS_CONFIG.ctaEvery === 0) out.push({ kind: "cta" });
  });
  return out;
}
