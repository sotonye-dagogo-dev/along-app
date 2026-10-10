/**
 * Media-cleanup configuration — ACID-safe Cloudinary orphan prevention.
 *
 * Policy:
 * - DB transactions ALWAYS commit first; Cloudinary destroys run AFTER the
 *   commit as best-effort side-effects that never fail the request.
 * - Only URLs matching the Cloudinary host + allowlisted folder prefixes are
 *   ever destroyed (prevents deleting third-party / DiceBear / seed URLs).
 * - Account finalization RETAINS anonymized post images per Data-Retention
 *   policy ("anonymised post data may be retained"); only a legacy Cloudinary
 *   avatar (if any) is purged.
 *
 * All values are metadata-driven (env-overridable) — no hardcoded policy in
 * services/routes/components.
 */

export interface MediaCleanupConfig {
  /** Master switch (env MEDIA_CLEANUP_ENABLED, default true). */
  enabled: boolean;
  /** Only destroy assets whose public_id starts with one of these. */
  allowedFolderPrefixes: string[];
  /** Cloudinary resource_type used for destroys. */
  resourceType: "image";
  /** Cap per cleanup call (protects latency on bulk deletes). */
  maxUrlsPerCall: number;
  /** Post single/bulk delete purges its images. */
  postDeleteCleanupEnabled: boolean;
  /** Post edit purges images removed from the images[] array. */
  postEditCleanupEnabled: boolean;
  /** Draft discard purges draft images not referenced by any live post. */
  draftCleanupEnabled: boolean;
  /** Bug-report REMOVE_POST purges the removed post's images. */
  moderationDeleteCleanupEnabled: boolean;
  /** Account finalize keeps anonymized post images (policy retention). */
  retainPostImagesOnAccountFinalize: boolean;
  /** Account finalize purges a legacy Cloudinary avatar URL (if any). */
  cleanupAvatarOnAccountFinalize: boolean;
  /** When true, log intent without calling Cloudinary (safe rehearsal). */
  dryRun: boolean;
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const MEDIA_CLEANUP_CONFIG: MediaCleanupConfig = {
  enabled: envFlag("MEDIA_CLEANUP_ENABLED", true),
  allowedFolderPrefixes: (process.env.MEDIA_CLEANUP_FOLDERS ?? "along/posts,along/avatars")
    .split(",")
    .map((s) => s.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean),
  resourceType: "image",
  maxUrlsPerCall: envInt("MEDIA_CLEANUP_MAX_URLS", 20),
  postDeleteCleanupEnabled: envFlag("MEDIA_CLEANUP_POST_DELETE", true),
  postEditCleanupEnabled: envFlag("MEDIA_CLEANUP_POST_EDIT", true),
  draftCleanupEnabled: envFlag("MEDIA_CLEANUP_DRAFTS", true),
  moderationDeleteCleanupEnabled: envFlag("MEDIA_CLEANUP_MODERATION", true),
  retainPostImagesOnAccountFinalize: true,
  cleanupAvatarOnAccountFinalize: envFlag("MEDIA_CLEANUP_ACCOUNT_AVATAR", true),
  dryRun: envFlag("MEDIA_CLEANUP_DRY_RUN", false),
};

export type MediaCleanupSource =
  | "post-delete"
  | "admin-post-delete"
  | "post-edit"
  | "bug-remove-post"
  | "draft-discard"
  | "account-avatar";
