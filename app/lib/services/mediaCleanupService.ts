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
 * Best-effort destroy of Cloudinary assets referenced by `urls`.
 * Safe to call after a DB commit; never throws.
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

    const publicIds: { url: string; publicId: string }[] = [];
    for (const url of cleanable) {
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
