/**
 * Composer photo-removal helper — client-safe (no Cloudinary SDK import).
 *
 * Policy (mirrors MEDIA_CLEANUP_CONFIG, server is the final gate):
 * - The UI removes the thumbnail immediately (responsive); Cloudinary
 *   destruction is a best-effort background call to POST /api/upload/cleanup
 *   which skips non-Cloudinary hosts, non-allowlisted folders, and URLs still
 *   referenced by any live post.
 * - Edit-originals (images that shipped with `editPost`) are NEVER cleaned up
 *   here: their fate belongs to the PATCH removed-images diff on save. Only
 *   session-uploaded / draft-restored orphans go through the immediate path.
 */

import { isCloudinaryUrl } from "@/app/lib/utils/cloudinaryUrls";

export interface ComposerRemoveDecision {
  /** Safe to fire the background cleanup call. */
  shouldCleanup: boolean;
  /** Why cleanup was skipped (for debug logging only, never user-facing). */
  skipReason?: "empty" | "not-cloudinary" | "edit-original" | "cleanup-disabled";
}

/**
 * Pure decision helper — decides whether a removed composer photo warrants
 * an immediate best-effort Cloudinary cleanup call.
 */
export function decideComposerPhotoCleanup(
  url: unknown,
  opts?: { isEditOriginal?: boolean; cleanupEnabled?: boolean }
): ComposerRemoveDecision {
  if (typeof url !== "string" || url.trim().length === 0) {
    return { shouldCleanup: false, skipReason: "empty" };
  }
  if (opts?.isEditOriginal === true) {
    return { shouldCleanup: false, skipReason: "edit-original" };
  }
  if (opts?.cleanupEnabled === false) {
    return { shouldCleanup: false, skipReason: "cleanup-disabled" };
  }
  if (!isCloudinaryUrl(url)) {
    return { shouldCleanup: false, skipReason: "not-cloudinary" };
  }
  return { shouldCleanup: true };
}

export interface CleanupComposerPhotoOpts {
  draftId?: string;
  /** Overrides the `source` sent to /api/upload/cleanup (default composer-remove). */
  source?: "composer-remove" | "draft-discard";
}

/**
 * Fire-and-forget, never-throw cleanup of removed composer photo(s).
 * Resolves once the best-effort request settles; callers must NOT await it
 * for UI updates (thumbnail removal is already applied).
 */
export async function cleanupComposerPhotos(
  urls: string[],
  opts?: CleanupComposerPhotoOpts
): Promise<void> {
  try {
    const clean = (Array.isArray(urls) ? urls : []).filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0
    );
    if (clean.length === 0) return;
    if (typeof fetch === "undefined") return;
    await fetch("/api/upload/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: clean.slice(0, 20),
        ...(opts?.draftId ? { draftId: opts.draftId } : {}),
        source: opts?.source ?? "composer-remove",
      }),
    }).catch(() => {
      /* best-effort — orphan stays, never surfaces to the user */
    });
  } catch {
    /* never throw from background hygiene */
  }
}
