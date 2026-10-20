"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Star, X } from "lucide-react";
import { AppButton } from "@/app/components/ui/AppButton";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnlineStatus, useRequireOnline } from "@/app/providers/OnlineStatusProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import { toastService } from "@/app/lib/services/toastService";
import { offlineFriendlyError } from "@/app/lib/utils/offlineGuard";
import { REVIEWS_CONFIG } from "@/app/lib/config/reviews";
import {
  REVIEW_NOTICE_CONFIG,
  accountAgeMsFromCreatedAt,
  readReviewNoticeState,
  reviewNoticeStorageKey,
  shouldShowReviewNotice,
} from "@/app/lib/config/reviewNotice";
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi";

/**
 * Floating "leave a review" notice with an embedded quick form.
 *
 * Shows once the signed-in account has aged past REVIEW_NOTICE_CONFIG
 * `minAccountAgeMs`, has no platform review (best-effort GET
 * /api/reviews?mine=1 — unknown status fails safe to hidden), and has not
 * been dismissed inside the re-ask window. Submission reuses the reviews
 * API; success records a persistent per-user done flag so the notice never
 * returns for that account.
 */
export default function ReviewNotice() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t: rawT } = useTranslation();
  const { isOnline } = useOnlineStatus();
  const requireOnline = useRequireOnline();
  const [collapsed, setCollapsed] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checkedRef = useRef(false);

  const tf = useCallback(
    (key: string, fallback: string) => {
      try {
        const value = rawT(key);
        return value === key ? fallback : value;
      } catch {
        return fallback;
      }
    },
    [rawT],
  );

  // Mark done + close (persistent for this account).
  const markDone = useCallback(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(
        reviewNoticeStorageKey(user.id),
        JSON.stringify({ doneAt: Date.now() }),
      );
    } catch {
      // Storage unavailable — the notice closes for this session anyway.
    }
    setEligible(false);
  }, [user?.id]);

  // Eligibility check: delay, then the pure gate matrix.
  useEffect(() => {
    if (checkedRef.current) return;
    if (isLoading) return;
    checkedRef.current = true;
    const timer = window.setTimeout(() => {
      if (!isAuthenticated || !user?.id) return;
      let state = readReviewNoticeState(null);
      try {
        state = readReviewNoticeState(window.localStorage.getItem(reviewNoticeStorageKey(user.id)));
      } catch {
        // Storage unavailable — treated as never dismissed/done.
      }
      const gate = shouldShowReviewNotice({
        isAuthed: isAuthenticated,
        accountAgeMs: accountAgeMsFromCreatedAt(user?.createdAt, Date.now()),
        nowMs: Date.now(),
        state,
        hasExistingReview: null,
      });
      if (!gate.show) return;
      // Best-effort "already reviewed?" probe. The SW covers GET
      // /api/reviews (SWR), so a cached copy still answers while offline;
      // any failure/empty response leaves the notice hidden (fail-safe).
      fetch(`/api/reviews?mine=1&limit=1`)
        .then(async (res) => (res && res.ok ? ((await res.json()) as { reviews?: unknown }) : null))
        .then((data) => {
          const mine = Array.isArray((data as { reviews?: unknown[] } | null)?.reviews)
            ? ((data as { reviews: unknown[] }).reviews.length > 0)
            : false;
          if (shouldShowReviewNotice({
            isAuthed: true,
            accountAgeMs: accountAgeMsFromCreatedAt(user?.createdAt, Date.now()),
            nowMs: Date.now(),
            state,
            hasExistingReview: mine,
          }).show) {
            setEligible(true);
          }
        })
        .catch(() => undefined);
    }, Math.max(REVIEW_NOTICE_CONFIG.requestDelayMs, 0));
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, isLoading, user?.id, user?.createdAt]);

  const dismiss = useCallback(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(
        reviewNoticeStorageKey(user.id),
        JSON.stringify({ dismissedAt: Date.now() }),
      );
    } catch {
      // Ignore — closed for this session regardless.
    }
    setEligible(false);
  }, [user?.id]);

  const submit = useCallback(async () => {
    if (!requireOnline(tf("reviewNotice.offlineAction", "leave your review"))) return;
    if (rating < REVIEWS_CONFIG.minRating || rating > REVIEWS_CONFIG.maxRating) {
      toastService.error(
        tf(
          "reviews.ratingRequired",
          `Pick a star rating from ${REVIEWS_CONFIG.minRating} to ${REVIEWS_CONFIG.maxRating}.`,
        ),
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        toastService.error(
          typeof data?.error === "string" ? data.error : offlineFriendlyError(new Error("review failed"), tf("reviewNotice.offlineAction", "leave your review")),
        );
        return;
      }
      toastService.success(
        tf("reviews.thanks", "Thanks! Your review is in — we'll show it here once approved."),
      );
      markDone();
    } catch (e) {
      toastService.error(offlineFriendlyError(e, tf("reviewNotice.offlineAction", "leave your review")));
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, requireOnline, tf, markDone]);

  if (!eligible || !isOnline) return null;

  const lane = laneBottom(FLOATING_UI_CONFIG.lanes.reviewNoticeBottomPx);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={tf("reviewNotice.expandLabel", "Leave a review")}
        className="fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-fit bg-bg-card border border-border px-3.5 py-2 shadow-md flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer focus-visible:outline focus-visible:outline-primary z-[55]"
        style={{ bottom: lane, borderRadius: "var(--radius-pill, 999px)" }}
      >
        <Star size={14} className="text-warning-border" aria-hidden />
        {tf("reviewNotice.collapsedLabel", "Leave a review?")}
        <ChevronUp size={14} className="text-text-muted" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="note"
      aria-live="polite"
      className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm bg-bg-card border border-border shadow-md p-4 z-[55]"
      style={{ bottom: lane, borderRadius: "var(--radius-lg, 12px)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
            <Star size={14} className="text-warning-border" aria-hidden />
            {tf("reviewNotice.title", "How is Along treating you?")}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {tf("reviewNotice.body", "A quick rating helps fellow commuters — takes a few seconds.")}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label={tf("reviewNotice.collapseLabel", "Minimize review prompt")}
            className="text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary rounded-circle p-1"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={tf("reviewNotice.notNow", "Not now")}
            className="text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary rounded-circle p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3" role="radiogroup" aria-label={tf("reviews.ratingLabel", "Your rating")}>
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
              className="p-1 bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-primary rounded-circle"
            >
              <Star size={22} className={active ? "fill-warning-border text-warning-border" : "text-text-muted"} />
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, REVIEWS_CONFIG.maxCommentLength))}
        placeholder={tf("reviews.commentPlaceholder", "How has Along helped your commute?")}
        rows={2}
        maxLength={REVIEWS_CONFIG.maxCommentLength}
        aria-label={tf("reviews.commentLabel", "Your review")}
        className="w-full mt-2 mb-2.5 px-3 py-2 rounded-lg border border-border bg-bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary bg-transparent border-none cursor-pointer rounded-sm px-1"
        >
          {tf("reviewNotice.notNow", "Not now")}
        </button>
        <AppButton variant="primary" size="sm" onClick={() => void submit()} disabled={submitting}>
          {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {tf("reviews.submit", "Submit review")}
        </AppButton>
      </div>
    </div>
  );
}
