/**
 * Server-only Cloudinary cleanup service — ACID-safe orphan prevention.
 *
 * Contract:
 * - Callers commit their Prisma transaction FIRST, then invoke
 *   `cleanupImagesByUrls()` as a best-effort post-commit side-effect.
 * - This service NEVER throws to callers: every failure is logged (+ Sentry
 *   capture) and returned in the result, so DB deletes are never rolled back
 *   or failed because Cloudinary was unreachable/misconfigured.
 * - Only allowlisted `along/*` assets are destroyed; everything else is
 *   reported as skipped.
 *
 * Server-only: imports the Cloudinary SDK. Never import from client bundles —
 * draft flows must call `POST /api/upload/cleanup` instead.
 */

import * as Sentry from "@sentry/nextjs";
import { v2 as cloudinary } from "cloudinary";
import {
  MEDIA_CLEANUP_CONFIG,
  type MediaCleanupSource,
} from "@/app/lib/config/mediaCleanup";
import {
  extractPublicId,
  filterCleanableUrls,
} from "@/app/lib/utils/cloudinaryUrls";

export interface MediaCleanupResult {
  enabled: boolean;
  dryRun: boolean;
  attempted: number;
  destroyed: number;
  failed: number;
  skippedNonCloudinary: number;
  skippedDisallowed: number;
  /** Assets kept because a live post/blog still references them (cross-post guard). */
  skippedReferenced: number;
  failures: { publicId: string; message: string }[];
}

export interface CleanupContext {
  source: MediaCleanupSource;
  postId?: string;
  userId?: string;
  draftId?: string;
}

function configureCloudinary(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;
  try {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    return true;
  } catch {
    return false;
  }
}

/**
 * Dependency surface for the live-reference guard. Injectable so unit tests
 * can supply fakes without touching Prisma or the blog store.
 */
export interface ReferenceGuardDeps {
  /** True when any live post still stores `url` in its images[] array. */
  findPostByImage?: (url: string) => Promise<unknown>;
  /** Full set of image URLs referenced by managed blog posts (or null to skip). */
  getBlogImageSet?: () => Promise<Set<string> | null>;
}

async function defaultFindPostByImage(url: string): Promise<unknown> {
  const { prisma } = await import("@/app/lib/db/prisma");
  return prisma.post.findFirst({
    where: { images: { has: url } },
    select: { id: true },
  });
}

async function defaultGetBlogImageSet(urls: string[], force = false): Promise<Set<string> | null> {
  // Blog assets live in SiteConfig (not Post rows); only pay for the store
  // read when a blog-folder URL is actually in the candidate set (or the
  // caller forces it, e.g. a blog-cover replace of a non-blog-folder URL).
  if (!force && !urls.some((u) => u.includes("/along/blog/"))) return null;
  try {
    const { getManagedPosts } = await import("@/app/lib/utils/blogStore");
    const { collectBlogPostImageUrls } = await import("@/app/lib/utils/blogImages");
    const referenced = new Set<string>();
    for (const p of await getManagedPosts()) {
      for (const u of collectBlogPostImageUrls(p)) referenced.add(u);
    }
    return referenced;
  } catch {
    // Store hiccup → null signals fail-OPEN (keep everything) to the caller.
    return null;
  }
}

/**
 * Partition cleanable URLs into `{ unreferenced, skippedReferenced }`.
 * Fail-OPEN: any DB/store hiccup keeps the asset (counted as referenced)
 * instead of risking a live post's image. Never throws.
 */
export interface ReferenceGuardOptions {
  /**
   * Force the managed-blog reference read even when no `/along/blog/` URL
   * is present (e.g. a blog-cover replace discarding a non-blog-folder
   * URL that a managed post may still reference). Default false.
   */
  includeBlogRefs?: boolean;
}

export async function filterUnreferencedUrls(
  urls: string[],
  deps: ReferenceGuardDeps = {},
  opts: ReferenceGuardOptions = {}
): Promise<{ unreferenced: string[]; skippedReferenced: number }> {
  const unreferenced: string[] = [];
  let skippedReferenced = 0;
  if (!Array.isArray(urls) || urls.length === 0) return { unreferenced, skippedReferenced };
  const findPostByImage = deps.findPostByImage ?? defaultFindPostByImage;
  let blogReferenced: Set<string> | null = null;
  try {
    blogReferenced = deps.getBlogImageSet
      ? await deps.getBlogImageSet()
      : await defaultGetBlogImageSet(urls, opts.includeBlogRefs === true);
  } catch {
    blogReferenced = null;
  }
  // Null blog set after a hiccup (or an injected null) means "unknown" —
  // blog-folder URLs are then kept (fail-open); non-blog URLs still check posts.
  // When the caller forced blog refs (blog-source flows) and the set is
  // unknown, keep everything — a blog may reference any of these URLs.
  const blogUnknown = blogReferenced === null;
  const blogForcedUnknown = blogUnknown && opts.includeBlogRefs === true;
  for (const url of urls.slice(0, MEDIA_CLEANUP_CONFIG.maxUrlsPerCall)) {
    try {
      if (blogReferenced?.has(url)) {
        skippedReferenced += 1;
        continue;
      }
      if (blogForcedUnknown) {
        skippedReferenced += 1;
        continue;
      }
      if (blogUnknown && url.includes("/along/blog/")) {
        skippedReferenced += 1;
        continue;
      }
      const ref = await findPostByImage(url);
      if (ref) skippedReferenced += 1;
      else unreferenced.push(url);
    } catch {
      // On DB hiccup, fail OPEN for safety: keep the asset (skip it).
      skippedReferenced += 1;
    }
  }
  return { unreferenced, skippedReferenced };
}

/**
 * Best-effort destroy of Cloudinary assets referenced by `urls`.
 * Safe to call after a DB commit; never throws.
 *
 * Cross-post guard: when `MEDIA_CLEANUP_CONFIG.guardLivePostReferences` is
 * on (default), every candidate is re-checked against live posts (+ managed
 * blog posts) just before destroying. Uploads are eager and URLs may be
 * shared across posts (draft duplicate / restore / edit→draft→repost), so
 * an edit-diff or delete of one post must never destroy an asset still
 * rendered by another live post. This single choke-point protects ALL
 * callers (post edit/delete, admin bulk, moderation, draft/composer flows).
 */
export async function cleanupImagesByUrls(
  urls: unknown,
  context: CleanupContext
): Promise<MediaCleanupResult> {
  const empty: MediaCleanupResult = {
    enabled: MEDIA_CLEANUP_CONFIG.enabled,
    dryRun: MEDIA_CLEANUP_CONFIG.dryRun,
    attempted: 0,
    destroyed: 0,
    failed: 0,
    skippedNonCloudinary: 0,
    skippedDisallowed: 0,
    skippedReferenced: 0,
    failures: [],
  };
  try {
    if (!MEDIA_CLEANUP_CONFIG.enabled) return empty;
    if (!Array.isArray(urls) || urls.length === 0) return empty;

    const capped = urls.slice(0, MEDIA_CLEANUP_CONFIG.maxUrlsPerCall);
    const cleanable = filterCleanableUrls(capped, MEDIA_CLEANUP_CONFIG.allowedFolderPrefixes);

    const stringUrls = (urls as unknown[]).filter((u): u is string => typeof u === "string");
    // Aggregate skip count (non-Cloudinary host OR outside the allowlisted
    // along/* folders). Callers treat attempted/destroyed/failed as the signal.
    empty.skippedNonCloudinary = stringUrls.length - cleanable.length;

    if (cleanable.length === 0) return empty;

    // Cross-post guard (just-before-destroy re-check closes the
    // check-then-destroy TOCTOU for callers that pre-filtered earlier).
    let destroyable = cleanable;
    if (MEDIA_CLEANUP_CONFIG.guardLivePostReferences) {
      const guard = await filterUnreferencedUrls(cleanable);
      destroyable = guard.unreferenced;
      empty.skippedReferenced = guard.skippedReferenced;
      if (destroyable.length === 0) return empty;
    }

    const publicIds: { url: string; publicId: string }[] = [];
    for (const url of destroyable) {
      const publicId = extractPublicId(url);
      if (publicId) publicIds.push({ url, publicId });
      else empty.skippedNonCloudinary += 1;
    }
    if (publicIds.length === 0) return empty;
    empty.attempted = publicIds.length;

    if (MEDIA_CLEANUP_CONFIG.dryRun) {
      console.info(
        `[mediaCleanup:${context.source}] dry-run would destroy ${publicIds.length}`,
        publicIds.map((p) => p.publicId)
      );
      return empty;
    }

    if (!configureCloudinary()) {
      console.warn(
        `[mediaCleanup:${context.source}] Cloudinary not configured — skipping destroy of ${publicIds.length} asset(s).`
      );
      return empty;
    }

    for (const { publicId } of publicIds) {
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: MEDIA_CLEANUP_CONFIG.resourceType,
        });
        empty.destroyed += 1;
      } catch (e) {
        empty.failed += 1;
        const message = e instanceof Error ? e.message : "destroy failed";
        empty.failures.push({ publicId, message });
        console.error(`[mediaCleanup:${context.source}] destroy failed for ${publicId}:`, e);
      }
    }

    if (empty.failed > 0) {
      try {
        Sentry.captureMessage(
          `[mediaCleanup:${context.source}] ${empty.failed}/${empty.attempted} Cloudinary destroys failed`,
          "warning"
        );
      } catch {
        /* telemetry best-effort */
      }
    }
    return empty;
  } catch (e) {
    console.error(`[mediaCleanup:${context.source}] unexpected cleanup error (non-fatal):`, e);
    return empty;
  }
}

/**
 * Fire-and-forget wrapper for request paths where the response must not wait
 * on Cloudinary latency. The DB commit has already happened; failures are
 * logged inside `cleanupImagesByUrls` and never surface to the caller.
 */
export function cleanupImagesInBackground(urls: unknown, context: CleanupContext): void {
  try {
    void cleanupImagesByUrls(urls, context).catch((e) => {
      console.error(`[mediaCleanup:${context.source}] background cleanup error (non-fatal):`, e);
    });
  } catch (e) {
    console.error(`[mediaCleanup:${context.source}] background scheduling failed (non-fatal):`, e);
  }
}
