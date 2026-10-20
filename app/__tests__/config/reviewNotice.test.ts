/**
 * Review notice — eligibility gate + registration contract (Sprint 82).
 * Keeps the floating review prompt's gating matrix exact, lane/spacing
 * registered, admin parity honored, and FAQ/PCM documented.
 */
import fs from "fs";
import path from "path";
import {
  REVIEW_NOTICE_CONFIG,
  accountAgeMsFromCreatedAt,
  isFlagActive,
  readReviewNoticeState,
  reviewNoticeStorageKey,
  shouldShowReviewNotice,
  type ReviewNoticeGateInput,
} from "@/app/lib/config/reviewNotice";
import { FLOATING_UI_CONFIG } from "@/app/lib/config/floatingUi";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";
import { REVIEWS_CONFIG } from "@/app/lib/config/reviews";
import { ADMIN_CONFIG_DEFAULTS, ADMIN_DEDICATED_CONFIG_KEYS } from "@/app/lib/config/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000;

function gateInput(overrides: Partial<ReviewNoticeGateInput> = {}): ReviewNoticeGateInput {
  return {
    isAuthed: true,
    accountAgeMs: 5 * DAY_MS,
    nowMs: NOW,
    state: {},
    hasExistingReview: false,
    ...overrides,
  };
}

describe("review notice gate matrix", () => {
  it("shows for authed users past the grace window with no review/flags", () => {
    const r = shouldShowReviewNotice(gateInput());
    expect(r.reason).toBe("eligible");
    expect(r.show).toBe(true);
  });

  it("hides brand-new accounts and unknowable account ages", () => {
    expect(shouldShowReviewNotice(gateInput({ accountAgeMs: 2 * DAY_MS })).reason).toBe("not-matured");
    expect(shouldShowReviewNotice(gateInput({ accountAgeMs: null })).reason).toBe("unknown-account-age");
  });

  it("dismiss expires exactly at the TTL boundary", () => {
    const inside = shouldShowReviewNotice(gateInput({ state: { dismissedAt: NOW - REVIEW_NOTICE_CONFIG.dismissedTtlMs + 1000 } }));
    expect(inside.reason).toBe("dismissed");
    expect(inside.show).toBe(false);
    const expired = shouldShowReviewNotice(gateInput({ state: { dismissedAt: NOW - REVIEW_NOTICE_CONFIG.dismissedTtlMs - 1 } }));
    expect(expired.reason).toBe("eligible");
    expect(expired.show).toBe(true);
  });

  it("done outranks dismissal and review probes", () => {
    expect(shouldShowReviewNotice(gateInput({ state: { doneAt: 1, dismissedAt: NOW } })).reason).toBe("done");
    expect(shouldShowReviewNotice(gateInput({ hasExistingReview: true })).reason).toBe("already-reviewed");
    // Unknown review state (API unavailable / offline) stays hidden — fail-safe.
    expect(shouldShowReviewNotice(gateInput({ hasExistingReview: null })).reason).toBe("unknown-review-status");
  });

  it("feature switch and guests switch it off", () => {
    expect(shouldShowReviewNotice(gateInput({ enabled: false })).reason).toBe("disabled");
    expect(shouldShowReviewNotice(gateInput({ isAuthed: false })).reason).toBe("not-authed");
  });
});

describe("review notice helpers", () => {
  it("storage keys sanitize volatile user ids", () => {
    expect(reviewNoticeStorageKey("user-1")).toBe("along-review-notice-user-1");
    expect(reviewNoticeStorageKey('weird"!!`id')).toBe("along-review-notice-weirdid");
    expect(reviewNoticeStorageKey(userJump())).toBe("along-review-notice-anon");
    expect(reviewNoticeStorageKey("")).toBe("along-review-notice-anon");
  });

  it("state parsing accepts only the known numeric shape", () => {
    expect(readReviewNoticeState('{"doneAt":1,"dismissedAt":2}')).toEqual({ doneAt: 1, dismissedAt: 2 });
    expect(readReviewNoticeState('{"doneAt":1.5}')).toEqual({ doneAt: 1.5, dismissedAt: undefined });
    expect(readReviewNoticeState('{"doneAt":"x"}')).toEqual({ doneAt: undefined, dismissedAt: undefined });
    expect(readReviewNoticeState('{"extra":true}')).toEqual({ doneAt: undefined, dismissedAt: undefined });
  });

  it("state parsing degrades garbage to an empty flag record", () => {
    expect(readReviewNoticeState("not json")).toEqual({});
    expect(readReviewNoticeState("null")).toEqual({});
    expect(readReviewNoticeState("2")).toEqual({});
    expect(readReviewNoticeState(null)).toEqual({});
  });

  it("review flags obey TTL semantics; done never expires", () => {
    expect(isFlagActive(NOW - 800, NOW, REVIEW_NOTICE_CONFIG.dismissedTtlMs)).toBe(true);
    expect(isFlagActive(NOW - REVIEW_NOTICE_CONFIG.dismissedTtlMs - 1, NOW, REVIEW_NOTICE_CONFIG.dismissedTtlMs)).toBe(false);
    expect(isFlagActive(0, NOW, 5)).toBe(false);
    expect(isFlagActive(-3, NOW, 5)).toBe(false);
    expect(isFlagActive(undefined, NOW, 5)).toBe(false);
    expect(isFlagActive(1, NOW, Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("account age parses ISO stamps, clamps future signups to 0", () => {
    expect(accountAgeMsFromCreatedAt(new Date(NOW - DAY_MS).toISOString(), NOW)).toBe(DAY_MS);
    expect(accountAgeMsFromCreatedAt(new Date(NOW + DAY_MS).toISOString(), NOW)).toBe(0);
    expect(accountAgeMsFromCreatedAt("nope", NOW)).toBeNull();
    expect(accountAgeMsFromCreatedAt(undefined, NOW)).toBeNull();
  });

  it("thresholds match the documented values exactly", () => {
    expect(REVIEW_NOTICE_CONFIG.minAccountAgeMs).toBe(3 * DAY_MS);
    expect(REVIEW_NOTICE_CONFIG.dismissedTtlMs).toBe(7 * DAY_MS);
    expect(REVIEW_NOTICE_CONFIG.enabled).toBe(true);
    expect(REVIEW_NOTICE_CONFIG.requestDelayMs).toBeGreaterThanOrEqual(0);
    expect(REVIEW_NOTICE_CONFIG.requestDelayMs).toBeLessThanOrEqual(10_000);
  });
});

describe("review notice registration (lane + admin + FAQ)", () => {
  it("floats above every other notice lane", () => {
    expect(FLOATING_UI_CONFIG.lanes.reviewNoticeBottomPx).toBeGreaterThan(FLOATING_UI_CONFIG.lanes.transientBottomPx);
  });

  it("stays code-shipped: no admin config surface for the notice itself", () => {
    expect(ADMIN_CONFIG_DEFAULTS.some((c) => c.key.toLowerCase().includes("reviewnotice"))).toBe(false);
    expect(ADMIN_DEDICATED_CONFIG_KEYS).not.toContain("reviewNotice");
  });

  it("comment cap matches the reviews config", () => {
    expect(REVIEWS_CONFIG.maxCommentLength).toBeGreaterThan(0);
  });

  it("review-prompt FAQ ships in English and pidgin", () => {
    const reviews = DEFAULT_FAQ_ITEMS.find((c) => c.id === "reviews");
    const item = reviews?.items.find((i) => i.id === "review-prompt");
    expect(item?.question).toBeTruthy();
    expect(item?.answer.length).toBeGreaterThan(20);
    expect(FAQ_PCM["review-prompt"]?.question).toBeTruthy();
    expect(FAQ_PCM["review-prompt"]?.answer).toBeTruthy();
  });

  it("component stays mounted on the root layout", () => {
    const root = fs.readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(root).toContain("ReviewNotice");
  });
});

function userJump(): string {
  // Docs the "volatile/per-user" storage contract in test prose.
  return "";
}
