/**
 * Review notice config — dismissible "leave a review" prompt.
 *
 * Zero app deps. Pure gating helpers make the timing contract testable:
 * the notice appears once the viewer's account is at least
 * `minAccountAgeMs` old (post-registration grace), disappears for
 * `dismissedTtlMs` after a dismissal, and never shows again after a
 * successful submission or when the viewer already has a platform review
 * (checked best-effort via GET /api/reviews?mine=1 — unknown status
 * offline/failed fetch = stay hidden, fail-safe).
 *
 * Storage is per-user (`storageKeyFor`) so shared devices don't bleed
 * dismissal state across accounts.
 */

export const REVIEW_NOTICE_CONFIG = {
  enabled: true,
  /** Signup grace before the first prompt (3 days). */
  minAccountAgeMs: 3 * 24 * 60 * 60 * 1000,
  /** Mount delay before the visibility check settles. */
  requestDelayMs: 2000,
  /** Re-ask interval after a dismissal (7 days). */
  dismissedTtlMs: 7 * 24 * 60 * 60 * 1000,
  storage: {
    /** Per-user blob { dismissedAt, doneAt } — suffix helper below. */
    stateKeyPrefix: "along-review-notice",
  },
} as const;

export type ReviewNoticeConfigShape = typeof REVIEW_NOTICE_CONFIG;

export function reviewNoticeStorageKey(userId: string): string {
  const safe = typeof userId === "string" ? userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) : "";
  return `${REVIEW_NOTICE_CONFIG.storage.stateKeyPrefix}${safe ? `-${safe}` : "-anon"}`;
}

export interface ReviewNoticeState {
  dismissedAt?: number;
  doneAt?: number;
}

export function readReviewNoticeState(raw: string | null): ReviewNoticeState {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<ReviewNoticeState> | null) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return {
      dismissedAt: Number.isFinite(parsed.dismissedAt) ? (parsed.dismissedAt as number) : undefined,
      doneAt: Number.isFinite(parsed.doneAt) ? (parsed.doneAt as number) : undefined,
    };
  } catch {
    return {};
  }
}

/** If the flag was recorded before this cutoff, treat it as expired/deleted. */
export function isFlagActive(atMs: number | undefined, nowMs: number, ttlMs: number): boolean {
  if (typeof atMs !== "number" || !Number.isFinite(atMs) || atMs <= 0) return false;
  return nowMs - atMs < ttlMs;
}

export type ReviewNoticeGateReason =
  | "eligible"
  | "disabled"
  | "not-authed"
  | "not-matured"
  | "unknown-account-age"
  | "dismissed"
  | "done"
  | "already-reviewed"
  | "unknown-review-status";

export interface ReviewNoticeGateInput {
  enabled?: boolean;
  isAuthed: boolean;
  /** null = account age not knowable (e.g. offline auth snapshot). */
  accountAgeMs: number | null;
  nowMs: number;
  state: ReviewNoticeState;
  /** true/false = known via API or cache; null = fetch failed / offline-no-cache. */
  hasExistingReview: boolean | null;
}

/**
 * The single source of truth for "should the review notice show?" —
 * exported as a pure helper so the component stays dumb and the matrix
 * (including every fallback path) is directly unit-testable.
 */
export function shouldShowReviewNotice(input: ReviewNoticeGateInput): {
  show: boolean;
  reason: ReviewNoticeGateReason;
} {
  if (!REVIEW_NOTICE_CONFIG.enabled || input.enabled === false) {
    return { show: false, reason: "disabled" };
  }
  if (!input.isAuthed) return { show: false, reason: "not-authed" };
  if (isFlagActive(input.state.doneAt, input.nowMs, Number.MAX_SAFE_INTEGER)) {
    return { show: false, reason: "done" };
  }
  if (isFlagActive(input.state.dismissedAt, input.nowMs, REVIEW_NOTICE_CONFIG.dismissedTtlMs)) {
    return { show: false, reason: "dismissed" };
  }
  if (input.accountAgeMs === null) return { show: false, reason: "unknown-account-age" };
  if (input.accountAgeMs < REVIEW_NOTICE_CONFIG.minAccountAgeMs) {
    return { show: false, reason: "not-matured" };
  }
  if (input.hasExistingReview === true) return { show: false, reason: "already-reviewed" };
  if (input.hasExistingReview === null) return { show: false, reason: "unknown-review-status" };
  return { show: true, reason: "eligible" };
}

/** Never-throw account age (registration → now); null when unknowable. */
export function accountAgeMsFromCreatedAt(createdAt: string | undefined, nowMs: number): number | null {
  if (!createdAt) return null;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;
  return Math.max(nowMs - created, 0);
}
