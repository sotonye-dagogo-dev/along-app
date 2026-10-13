/**
 * Report-attachments configuration (config-driven, zero app deps).
 *
 * Optional screenshots on both report surfaces (dedicated post/comment
 * reports via ReportDialog → /api/reports, and platform bug reports via
 * /report-bug → /api/bug-reports). Images ride in `BugReport.metadata.images`
 * so NO migration is needed — readers tolerate absence.
 *
 * Cloudinary policy: uploads land in `along/reports` (never in `along/posts`,
 * so post-image pipelines and cleanup guards stay disjoint); per-file cap is
 * 2MB and at most 3 files per report. The cleanup allowlist
 * (MEDIA_CLEANUP_CONFIG) covers the folder with a `report-discard` source so
 * abandoned uploads are purged like draft images.
 */

export interface ReportAttachmentsConfig {
  /** Master switch — when false the upload UI is hidden and APIs drop images. */
  enabled: boolean;
  /** Max screenshots per report. */
  maxImages: number;
  /** Max bytes per screenshot (2MB). */
  maxBytesPerImage: number;
  /** Cloudinary folder for report uploads. */
  folder: string;
  /** Allowed upload MIME types (subset of the post pipeline). */
  allowedTypes: string[];
  /** Copy for the upload UI (sanitized, user-facing). */
  copy: {
    label: string;
    hint: string;
    addLabel: string;
    removeLabel: string;
    tooMany: string;
    tooLarge: string;
    badType: string;
    uploadFailed: string;
  };
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const REPORT_ATTACHMENTS_CONFIG: ReportAttachmentsConfig = {
  enabled: process.env.REPORT_ATTACHMENTS_ENABLED !== "0",
  maxImages: envInt("REPORT_ATTACHMENTS_MAX", 3),
  maxBytesPerImage: envInt("REPORT_ATTACHMENTS_MAX_BYTES", 2 * 1024 * 1024),
  folder: "along/reports",
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"],
  copy: {
    label: "Screenshots (optional)",
    hint: "Up to 3 images, 2MB each. They help our team see what you saw.",
    addLabel: "Add screenshots",
    removeLabel: "Remove screenshot",
    tooMany: "You can attach up to 3 screenshots.",
    tooLarge: "Each screenshot must be under 2MB.",
    badType: "Use JPEG, PNG, WebP or GIF images.",
    uploadFailed: "Could not upload that image. Please try again.",
  },
};

/** Human "2MB" style label derived from the byte cap (no hardcoded copy). */
export function reportMaxSizeLabel(): string {
  const mb = REPORT_ATTACHMENTS_CONFIG.maxBytesPerImage / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

/**
 * ACID / idempotency config for bug-report submission (config-driven).
 * - `dedupWindowSec`: same reporter + same title/description within this
 *   window returns the existing row instead of creating a duplicate
 *   (covers double-click, retry-after-timeout, multi-tab submits).
 * - `idempotencyHeader`: clients may send Idempotency-Key; the key is stored
 *   in metadata.idempotencyKey and re-presenting it returns the original row.
 */
export const BUG_REPORT_DEDUP_CONFIG = {
  dedupWindowSec: 600,
  idempotencyHeader: "x-idempotency-key",
  maxKeyLength: 128,
} as const;

/**
 * Validates report image URLs server-side (never throws).
 * Accepts only https Cloudinary URLs under the report folder so callers can
 * never smuggle third-party / seed / avatar URLs into report metadata.
 */
export function sanitizeReportImageUrls(input: unknown): string[] {
  if (!REPORT_ATTACHMENTS_CONFIG.enabled) return [];
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (out.length >= REPORT_ATTACHMENTS_CONFIG.maxImages) break;
    if (typeof raw !== "string") continue;
    const url = raw.trim().slice(0, 500);
    if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) continue;
    if (!url.includes(`/${REPORT_ATTACHMENTS_CONFIG.folder}/`)) continue;
    out.push(url);
  }
  return out;
}
