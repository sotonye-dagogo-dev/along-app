import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config/mediaCleanup";
import { filterCleanableUrls } from "@/app/lib/utils/cloudinaryUrls";
import { cleanupImagesByUrls } from "@/app/lib/services/mediaCleanupService";

/**
 * POST /api/upload/cleanup — destroy orphaned Cloudinary uploads.
 *
 * Used by client-side draft discards AND single-photo removes in the
 * share-route composer (drafts live in localStorage but their
 * images were eagerly uploaded). ACID-safe:
 * - Auth required; URLs capped + restricted to allowlisted `along/*` assets.
 * - URLs still referenced by ANY live post are skipped (publish-then-discard
 *   reuses the same URLs — deleting them would break the new post; the same
 *   guard protects edit-originals removed in the composer before PATCH).
 * - Cloudinary failures never fail the request (best-effort); the draft row
 *   (localStorage) is already gone client-side regardless.
 */

const CLEANUP_SCHEMA = z.object({
  urls: z.array(z.string().min(1).max(2048)).max(20).default([]),
  draftId: z.string().max(120).optional(),
  source: z.enum(["draft-discard", "composer-remove"]).default("draft-discard"),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!MEDIA_CLEANUP_CONFIG.enabled || !MEDIA_CLEANUP_CONFIG.draftCleanupEnabled) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "media cleanup disabled" },
        { status: 200 }
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = CLEANUP_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const source = parsed.data.source;
    if (source === "composer-remove" && !MEDIA_CLEANUP_CONFIG.composerRemoveCleanupEnabled) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "composer-remove cleanup disabled" },
        { status: 200 }
      );
    }

    const cleanable = filterCleanableUrls(
      parsed.data.urls,
      MEDIA_CLEANUP_CONFIG.allowedFolderPrefixes
    );
    const skippedNonCloudinary = parsed.data.urls.length - cleanable.length;
    if (cleanable.length === 0) {
      return NextResponse.json(
        { ok: true, destroyed: 0, skippedReferenced: 0, skippedNonCloudinary },
        { status: 200 }
      );
    }

    // Guard: never delete an asset still referenced by a live post.
    // (Draft published → same URLs now live on the post; discard must keep them.)
    const unreferenced: string[] = [];
    let skippedReferenced = 0;
    for (const url of cleanable.slice(0, MEDIA_CLEANUP_CONFIG.maxUrlsPerCall)) {
      try {
        const ref = await prisma.post.findFirst({
          where: { images: { has: url } },
          select: { id: true },
        });
        if (ref) skippedReferenced += 1;
        else unreferenced.push(url);
      } catch {
        // On DB hiccup, fail OPEN for safety: keep the asset (skip it).
        skippedReferenced += 1;
      }
    }

    if (unreferenced.length === 0) {
      return NextResponse.json(
        { ok: true, destroyed: 0, skippedReferenced, skippedNonCloudinary },
        { status: 200 }
      );
    }

    const result = await cleanupImagesByUrls(unreferenced, {
      source,
      userId: (user as { id?: string }).id,
      draftId: parsed.data.draftId,
    });

    return NextResponse.json(
      {
        ok: true,
        destroyed: result.destroyed,
        failed: result.failed,
        skippedReferenced,
        skippedNonCloudinary,
      },
      { status: 200 }
    );
  } catch (error) {
    // Best-effort endpoint: never leak internals, never 500 on Cloudinary issues.
    console.error("[upload/cleanup] non-fatal error:", error);
    return NextResponse.json({ ok: true, destroyed: 0, bestEffort: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST with { urls }. " }, { status: 405 });
}
