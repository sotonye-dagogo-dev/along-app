"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star, Loader2 } from "lucide-react";
import { AppAvatar } from "@/app/components/ui";
import { useAuth } from "@/app/hooks/useAuth";
import { useTranslation } from "@/app/providers/I18nProvider";
import { toastService } from "@/app/lib/services/toastService";
import { requireOnline, offlineFriendlyError } from "@/app/lib/utils/offlineGuard";
import { REVIEWS_CONFIG, reviewAuthorName, type PlatformReviewItem } from "@/app/lib/config/reviews";

interface MineResponse {
  reviews: PlatformReviewItem[];
}

/**
 * User access point for platform reviews: star form (one review per user,
 * re-submit updates), own pending status, latest community reviews, and a
 * short how-it-works note. Guests get a sign-in prompt. All copy is
 * dictionary-driven with English fallbacks.
 *
 * Props:
 * - showList: render the community list below the form (default true).
 * - showForm: render the leave-a-review form (default true; false on other
 *   users' profiles where the tab is read-only context).
 * - authorId: scope the list to one author's platform review (other-user
 *   profile tab). Form still posts the viewer's own review when shown.
 */
export function ReviewsPanel({ showList = true, showForm = true, authorId }: { showList?: boolean; showForm?: boolean; authorId?: string }) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { tf } = useTranslation();
  const [rating, setRating] = useState<number>(REVIEWS_CONFIG.defaultRating);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<PlatformReviewItem | null>(null);
  const [reviews, setReviews] = useState<PlatformReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listUrl = authorId
        ? `/api/reviews?limit=${REVIEWS_CONFIG.listLimit}&authorId=${encodeURIComponent(authorId)}`
        : `/api/reviews?limit=${REVIEWS_CONFIG.listLimit}`;
      const [pubRes, mineRes] = await Promise.all([
        showList ? fetch(listUrl) : Promise.resolve(null),
        isAuthenticated && showForm ? fetch("/api/reviews?mine=1&limit=5") : Promise.resolve(null),
      ]);
      if (pubRes && pubRes.ok) {
        const data = (await pubRes.json()) as MineResponse;
        setReviews(data.reviews ?? []);
      }
      if (mineRes && mineRes.ok) {
        const data = (await mineRes.json()) as MineResponse;
        const own = (data.reviews ?? []).find((r) => user && r.reviewer.id === (user as { id?: string }).id) ?? null;
        setMine(own);
        if (own) {
          setRating(own.rating);
          setComment(own.comment ?? "");
        }
      }
    } catch {
      // Offline / transient — keep cached/empty state, never raw errors.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, authorId, showForm, showList]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const submit = async () => {
    if (!requireOnline("leave a review")) return;
    if (rating < REVIEWS_CONFIG.minRating || rating > REVIEWS_CONFIG.maxRating) {
      toastService.error(tf("reviews.ratingRequired", `Pick a star rating from ${REVIEWS_CONFIG.minRating} to ${REVIEWS_CONFIG.maxRating}.`));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastService.error(typeof data?.error === "string" ? data.error : offlineFriendlyError(new Error("review failed"), "save your review"));
        return;
      }
      toastService.success(tf("reviews.thanks", "Thanks! Your review is in — we'll show it here once approved."));
      void load();
    } catch (e) {
      toastService.error(offlineFriendlyError(e, "save your review"));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="h-40 rounded-xl bg-bg-elevated animate-pulse" />
        <div className="h-24 rounded-xl bg-bg-elevated animate-pulse" />
      </div>
    );
  }

  // Guests only hit the sign-in gate when the form is part of the view;
  // read-only contexts (e.g. another user's Reviews tab) still show the list.
  if (!isAuthenticated && showForm) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
        <div className="flex justify-center gap-1 mb-3" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={18} className="text-warning-border" />
          ))}
        </div>
        <p className="text-sm text-text-secondary mb-4">
          {tf("reviews.signInPrompt", "Sign in to leave a review and help fellow commuters.")}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold no-underline hover:opacity-90"
        >
          {tf("reviews.signInCta", "Sign in to review")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Form */}
      {showForm && (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-base font-semibold mb-1">{tf("reviews.formTitle", "Leave a review")}</h3>
        <p className="text-xs text-text-muted mb-4">{tf("reviews.onePerUser", "You can leave one review — submitting again updates it.")}</p>
        <div className="flex items-center gap-1 mb-1" role="radiogroup" aria-label={tf("reviews.ratingLabel", "Your rating")}>
          {Array.from({ length: REVIEWS_CONFIG.maxRating }).map((_, i) => {
            const value = i + 1;
            const active = value <= rating;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                onClick={() => setRating(value)}
                className="p-1 bg-transparent border-none cursor-pointer"
              >
                <Star size={26} className={active ? "fill-warning-border text-warning-border" : "text-text-muted"} />
              </button>
            );
          })}
        </div>
        <label htmlFor="review-comment" className="text-xs font-medium text-text-secondary">
          {tf("reviews.commentLabel", "Your review")}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, REVIEWS_CONFIG.maxCommentLength))}
          placeholder={tf("reviews.commentPlaceholder", "How has Along helped your commute?")}
          rows={3}
          maxLength={REVIEWS_CONFIG.maxCommentLength}
          className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-border bg-bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting
            ? tf("reviews.submitting", "Submitting…")
            : mine
              ? tf("reviews.update", "Update review")
              : tf("reviews.submit", "Submit review")}
        </button>
        {mine?.status === "PENDING" && (
          <p className="text-xs text-warning-text mt-3" role="note">
            {tf("reviews.pendingNote", "Your review is awaiting approval and only you can see it for now.")}
          </p>
        )}
      </div>
      )}

      {/* How it works */}
      <div className="bg-bg-elevated border border-border rounded-xl p-4">
        <div className="text-sm font-semibold mb-1">{tf("reviews.faqTitle", "How reviews work")}</div>
        <p className="text-xs text-text-secondary leading-relaxed">{tf("reviews.faqBody", "Head to your profile, open the Reviews tab, pick a star rating and write a few words. Reviews are moderated before they appear publicly, and you'll get a thank-you notification once yours is in.")}</p>
      </div>

      {/* Latest community reviews */}
      {showList && (
        <div className="flex flex-col gap-2">
          {reviews.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              {tf("reviews.empty", "No approved reviews yet. Be the first to share your experience.")}
            </p>
          ) : (
            reviews.map((r) => {
              const name = reviewAuthorName(r.reviewer);
              return (
                <div key={r.id} className="bg-bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AppAvatar
                      src={r.reviewer.avatar ?? undefined}
                      alt={name}
                      size={32}
                      config={(r.reviewer.avatarConfig ?? undefined) as { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | undefined}
                      userName={r.reviewer.userName}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{name}</div>
                      <div className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                        {Array.from({ length: REVIEWS_CONFIG.maxRating }).map((_, i) => (
                          <Star key={i} size={12} className={i < r.rating ? "fill-warning-border text-warning-border" : "text-text-muted"} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-text-secondary leading-relaxed">{r.comment}</p>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
