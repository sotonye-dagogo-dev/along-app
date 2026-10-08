/**
 * Post-submit hardening configuration (config-driven, zero app deps).
 * Single source of truth for double-submit protection and POST /api/posts
 * idempotency: the composer generates one `clientMutationId` per editing
 * session, sends it as `idempotencyHeader`, and the server replays the
 * original response when the same key arrives twice (double-click, retry).
 */
export interface PostSubmitConfig {
  /** Request header carrying the client mutation id. */
  idempotencyHeader: string;
  /** How long (ms) the server remembers a mutation key for replay. */
  idempotencyTtlMs: number;
  /** Prefix for server-side idempotency store keys. */
  idempotencyKeyPrefix: string;
  /** Share-modal submit button label (idle). */
  shareLabel: string;
  /** Share-modal submit button label while the post is in flight. */
  sharingLabel: string;
  /** Response-mode submit button label (idle). */
  responseShareLabel: string;
  /** Response-mode submit button label while the post is in flight. */
  responseSharingLabel: string;
}

export const POST_SUBMIT_CONFIG: PostSubmitConfig = {
  idempotencyHeader: "x-idempotency-key",
  idempotencyTtlMs: 5 * 60 * 1000,
  idempotencyKeyPrefix: "post-submit:",
  shareLabel: "Share Route",
  sharingLabel: "Sharing…",
  responseShareLabel: "Post Response",
  responseSharingLabel: "Posting…",
};
