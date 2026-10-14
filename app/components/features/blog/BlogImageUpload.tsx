"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { BLOG_IMAGE_CONFIG, blogMaxSizeLabel } from "@/app/lib/config/blogManagement";
import { BLOG_MANAGEMENT_CONFIG } from "@/app/lib/config/blogManagement";
import { resolveBlogImageUrl, hasCustomBlogImage } from "@/app/lib/utils/blogImages";
import { toastService } from "@/app/lib/services/toastService";

interface BlogImageUploadProps {
  /** Current cover/image URL (resolved for preview; default cover shows empty state). */
  value: string;
  /** Called with the new URL (uploaded Cloudinary URL or pasted URL). */
  onChange: (url: string) => void;
  /**
   * Called with the REPLACED/REMOVED Cloudinary URL so the caller can purge it
   * best-effort after a successful save (ACID: DB first, destroy after commit).
   * Fire the actual POST /api/upload/cleanup in the caller — this component
   * never deletes server-side on its own (preview swaps are reversible until save).
   */
  onReplaced?: (oldUrl: string) => void;
  disabled?: boolean;
  /** Compact inline variant (per image block) vs full cover variant. */
  variant?: "cover" | "inline";
}

/**
 * Reusable Blog Studio image picker — cover + inline blocks share it.
 * - Upload eagerly to Cloudinary `along/blog` (caps/types from BLOG_IMAGE_CONFIG).
 * - Or paste any https / site-relative URL (validated via resolveBlogImageUrl).
 * - Replace/remove only swaps the preview; the caller purges the orphan
 *   best-effort AFTER a successful save/delete (see onReplaced). Never throws.
 */
export default function BlogImageUpload({
  value,
  onChange,
  onReplaced,
  disabled = false,
  variant = "cover",
}: BlogImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const copy = BLOG_IMAGE_CONFIG.copy;
  const resolved = resolveBlogImageUrl(value);
  const hasCustom = hasCustomBlogImage(value);
  const isCover = variant === "cover";

  const emitReplace = useCallback(
    (nextUrl: string) => {
      const prev = typeof value === "string" ? value.trim() : "";
      onChange(nextUrl);
      setUrlDraft(null);
      // Only Cloudinary assets are purgeable; the cleanup endpoint skips the
      // rest anyway, but reporting only real replacements keeps audit noise down.
      if (prev && prev !== nextUrl && /^https:\/\/res\.cloudinary\.com\//.test(prev)) {
        try {
          onReplaced?.(prev);
        } catch {
          /* never throw from hygiene */
        }
      }
    },
    [value, onChange, onReplaced],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      const file = list[0];
      if (!BLOG_IMAGE_CONFIG.allowedTypes.includes(file.type)) {
        toastService.error(copy.badType);
        return;
      }
      if (file.size > BLOG_IMAGE_CONFIG.maxBytesPerImage) {
        toastService.error(`${copy.tooLarge} (max ${blogMaxSizeLabel()})`);
        return;
      }
      if (file.size === 0) {
        toastService.error(copy.badType);
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", BLOG_IMAGE_CONFIG.uploadFolderKey);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const payload = (await res.json().catch(() => null)) as
          | { urls?: string[]; error?: string }
          | null;
        if (!res.ok || !payload || !Array.isArray(payload.urls) || !payload.urls[0]) {
          throw new Error(payload?.error ?? "upload failed");
        }
        emitReplace(payload.urls[0]);
        toastService.success(isCover ? "Cover uploaded" : "Image uploaded");
      } catch (e) {
        toastService.error(e instanceof Error && e.message && !/upload failed/i.test(e.message) ? e.message : copy.uploadFailed);
      } finally {
        setUploading(false);
        try {
          if (inputRef.current) inputRef.current.value = "";
        } catch {
          /* ignore */
        }
      }
    },
    [copy, emitReplace, isCover],
  );

  const applyUrlDraft = useCallback(() => {
    const raw = (urlDraft ?? "").trim();
    if (!raw) return;
    if (/^\s*(javascript|data|vbscript|blob):/i.test(raw)) {
      toastService.error(copy.badType);
      return;
    }
    if (!(raw.startsWith("/") || /^https?:\/\//i.test(raw))) {
      toastService.error(copy.badType);
      return;
    }
    emitReplace(raw.slice(0, 500));
  }, [urlDraft, copy, emitReplace]);

  const handleRemove = useCallback(() => {
    emitReplace(BLOG_MANAGEMENT_CONFIG.defaultImage);
    setUrlDraft("");
  }, [emitReplace]);

  return (
    <div className={isCover ? "" : "flex flex-col gap-1.5"}>
      {isCover && (
        <span className="text-text-muted font-medium">{copy.coverLabel}</span>
      )}
      {hasCustom ? (
        <div
          className={
            isCover
              ? "relative rounded-lg overflow-hidden border border-border bg-bg-elevated aspect-[16/9]"
              : "relative w-full rounded-md overflow-hidden border border-border bg-bg-elevated aspect-[16/9]"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolved} alt={isCover ? "Cover preview" : "Block image preview"} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || uploading}
            aria-label={copy.coverRemoveLabel}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 text-white grid place-items-center hover:bg-black/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div
          className={
            isCover
              ? "rounded-lg border border-dashed border-border bg-bg-elevated/50 aspect-[16/9] grid place-items-center text-text-muted text-xs px-4 text-center"
              : "rounded-md border border-dashed border-border bg-bg-elevated/50 py-3 grid place-items-center text-text-muted text-xs px-3 text-center"
          }
        >
          {isCover ? copy.coverHint : copy.inlineHint} (max {blogMaxSizeLabel()})
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap items-center mt-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={BLOG_IMAGE_CONFIG.allowedTypes.join(",")}
          disabled={disabled || uploading}
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
          }}
          className="hidden"
          aria-label={isCover ? copy.coverAddLabel : copy.inlineAddLabel}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 radius-md border border-border bg-bg-card text-xs font-semibold cursor-pointer hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {uploading ? "Uploading…" : hasCustom ? (isCover ? copy.coverReplaceLabel : copy.inlineAddLabel) : (isCover ? copy.coverAddLabel : copy.inlineAddLabel)}
        </button>
        <input
          value={urlDraft ?? ""}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyUrlDraft();
            }
          }}
          placeholder={copy.urlPlaceholder}
          aria-label={copy.urlLabel}
          disabled={disabled || uploading}
          className="flex-1 min-w-[160px] rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-xs font-mono"
        />
        <button
          type="button"
          onClick={applyUrlDraft}
          disabled={disabled || uploading || !(urlDraft ?? "").trim()}
          className="px-2.5 py-1.5 radius-md bg-bg-elevated text-xs font-semibold cursor-pointer border border-border disabled:opacity-50"
        >
          Use URL
        </button>
      </div>
    </div>
  );
}
