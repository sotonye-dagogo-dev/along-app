"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, MessageSquareHeart } from "lucide-react";
import { EndlessCarousel } from "@/app/components/features/suggestions/EndlessCarousel";
import {
  ENDLESS_CAROUSEL_CONFIG,
  REVIEWS_CONFIG,
  insertReviewCtaPanels,
  reviewAuthorName,
  type PlatformReviewItem,
} from "@/app/lib/config";
import { useTranslation } from "@/app/providers/I18nProvider";
import { useAuth } from "@/app/hooks/useAuth";
import { AppAvatar } from "@/app/components/ui";

interface Props {
  /** Section heading fallback (dictionary-overridable). */
  title?: string;
  subtitle?: string;
  /** Compact vertical rhythm for tight pages (invite). */
  compact?: boolean;
}

/**
 * Reusable community-reviews tape — the same EndlessCarousel
 * design/animation/physics as About + blogs. One implementation reused on
 * landing, invite, and About (About keeps its own copy for layout reasons;
 * new surfaces use this). Renders nothing when no approved reviews exist
 * (host controls layout), except a CTA-only tape when explicitly desired.
 * Non-breaking, config-driven, dictionary-overridable.
 */
export function ReviewsCarouselSection({ title, subtitle, compact = false }: Props) {
  const { tf } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<PlatformReviewItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?limit=${REVIEWS_CONFIG.maxListLimit}`)
      .then((res) => (res.ok ? res.json() : { reviews: [] }))
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // No flash of empty section: loading skeleton, then null when truly empty.
  if (reviews !== null && reviews.length === 0) return null;

  const heading = title ?? tf("about.reviews.title", "What Commuters Say");
  const sub = subtitle ?? tf("about.reviews.subtitle", "Real riders, real routes, real feedback");
  const stream = insertReviewCtaPanels(reviews ?? []);
  const items = stream.map((entry, i) =>
    entry.kind === "cta" ? (
      <ReviewCtaPanel key={`cta-${i}`} isAuthenticated={isAuthenticated} />
    ) : (
      <ReviewCard key={entry.review.id} review={entry.review} />
    ),
  );

  return (
    <section aria-label={heading} className={`w-full min-w-0 max-w-full overflow-x-clip bg-primary-muted ${compact ? "py-6" : "py-12"}`}>
      <div className="mx-auto w-full min-w-0 max-w-[1100px] px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{heading}</h2>
          <p className="text-sm text-text-secondary max-w-[500px] mx-auto">{sub}</p>
        </div>
        {reviews === null ? (
          <div className="flex w-full min-w-0 max-w-full gap-4 overflow-hidden" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-[280px] sm:w-[320px] h-[180px] rounded-2xl bg-bg-card/60 animate-pulse shrink-0" />
            ))}
          </div>
        ) : (
          <EndlessCarousel
            items={items}
            label="Commuter reviews"
            durationSec={ENDLESS_CAROUSEL_CONFIG.defaultDurationSec}
          />
        )}
      </div>
    </section>
  );
}

function ReviewCard({ review: r }: { review: PlatformReviewItem }) {
  const { tf } = useTranslation();
  const name = reviewAuthorName(r.reviewer);
  return (
    <div className="w-[280px] sm:w-[320px] glass rounded-2xl p-7 shrink-0">
      <div className="flex gap-0.5 mb-3" aria-label={`${r.rating} out of 5 stars`}>
        {Array.from({ length: REVIEWS_CONFIG.maxRating }).map((_, i) => (
          <Star key={i} size={16} className={i < r.rating ? "fill-warning-border text-warning-border" : "text-text-muted"} />
        ))}
      </div>
      {r.comment ? (
        <div className="text-sm text-text-primary leading-relaxed mb-4 italic">
          &ldquo;{r.comment}&rdquo;
        </div>
      ) : (
        <div className="text-sm text-text-muted leading-relaxed mb-4 italic">
          {tf("about.reviewNoComment", "Rated Along {stars} out of 5.", { stars: r.rating })}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <AppAvatar
          src={r.reviewer.avatar ?? undefined}
          alt={name}
          size={32}
          config={(r.reviewer.avatarConfig ?? undefined) as { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | undefined}
          userName={r.reviewer.userName}
        />
        <div>
          <div className="text-xs font-semibold">{name}</div>
          <div className="text-[11px] text-text-muted">@{r.reviewer.userName || "deleted-user"}</div>
        </div>
      </div>
    </div>
  );
}

function ReviewCtaPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { tf } = useTranslation();
  return (
    <div className="w-[280px] sm:w-[320px] rounded-2xl p-7 shrink-0 flex flex-col items-center justify-center text-center gap-3 bg-primary text-white">
      <MessageSquareHeart size={28} aria-hidden />
      <div className="text-base font-bold">{tf("about.reviewCta.title", "Used Along today?")}</div>
      <p className="text-xs text-white/85 leading-relaxed">
        {tf("about.reviewCta.body", "Tell commuters how it went — your rating keeps routes honest.")}
      </p>
      <Link
        href={isAuthenticated ? "/profile#reviews" : "/register"}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-primary text-xs font-bold no-underline hover:opacity-90"
      >
        {isAuthenticated
          ? tf("about.reviewCta.leave", "Leave a review")
          : tf("about.reviewCta.signIn", "Sign in to leave a review")}
      </Link>
    </div>
  );
}
