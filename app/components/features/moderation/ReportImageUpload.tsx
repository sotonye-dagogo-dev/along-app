"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { REPORT_ATTACHMENTS_CONFIG, reportMaxSizeLabel } from "@/app/lib/config/reportAttachments";
import { toastService } from "@/app/lib/services/toastService";

interface ReportImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}

/**
 * Optional screenshot picker for report surfaces (shared by the post Report
 * dialog and the platform bug-report page). Uploads eagerly to Cloudinary
 * `along/reports` (≤3 files, ≤2MB each per REPORT_ATTACHMENTS_CONFIG);
 * removals purge the orphan via /api/upload/cleanup (report-discard source,
 * best-effort — a failed purge never blocks the report). Never throws.
 */
export function ReportImageUpload({ images, onChange, disabled = false }: ReportImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const copy = REPORT_ATTACHMENTS_CONFIG.copy;
  const enabled = REPORT_ATTACHMENTS_CONFIG.enabled;

  const atCap = images.length >= REPORT_ATTACHMENTS_CONFIG.maxImages;

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (images.length + list.length > REPORT_ATTACHMENTS_CONFIG.maxImages) {
        toastService.error(copy.tooMany);
        return;
      }
      for (const f of list) {
        if (!REPORT_ATTACHMENTS_CONFIG.allowedTypes.includes(f.type)) {
          toastService.error(copy.badType);
          return;
        }
        if (f.size > REPORT_ATTACHMENTS_CONFIG.maxBytesPerImage) {
          toastService.error(copy.tooLarge);
          return;
        }
        if (f.size === 0) {
          toastService.error(copy.badType);
          return;
        }
      }
      setUploading(true);
      try {
        const form = new FormData();
        for (const f of list) form.append("file", f);
        form.append("folder", "reports");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const payload = (await res.json().catch(() => null)) as { urls?: string[]; error?: string } | null;
        if (!res.ok || !payload || !Array.isArray(payload.urls)) {
          throw new Error(payload?.error ?? "upload failed");
        }
        onChange([...images, ...payload.urls].slice(0, REPORT_ATTACHMENTS_CONFIG.maxImages));
      } catch {
        toastService.error(copy.uploadFailed);
      } finally {
        setUploading(false);
        try {
          if (inputRef.current) inputRef.current.value = "";
        } catch {
          /* ignore */
        }
      }
    },
    [images, onChange, copy]
  );

  const removeAt = useCallback(
    (index: number) => {
      const removed = images[index];
      onChange(images.filter((_, i) => i !== index));
      if (removed) {
        // Best-effort orphan purge — never blocks the report flow.
        fetch("/api/upload/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [removed], source: "report-discard" }),
        }).catch(() => undefined);
      }
    },
    [images, onChange]
  );

  // Gated render AFTER all hooks (rules-of-hooks safe when toggled).
  if (!enabled) return null;

  return (
    <div>
      <span className="block text-sm font-medium mb-1 text-text-primary">{copy.label}</span>
      <p className="text-xs text-text-secondary mb-2">
        {copy.hint.replace("3 images", `${REPORT_ATTACHMENTS_CONFIG.maxImages} images`).replace("2MB", reportMaxSizeLabel())}
      </p>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled || uploading}
                aria-label={`${copy.removeLabel} ${i + 1}`}
                className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 text-white grid place-items-center hover:bg-black/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={REPORT_ATTACHMENTS_CONFIG.allowedTypes.join(",")}
        multiple
        disabled={disabled || uploading || atCap}
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
        }}
        className="hidden"
        aria-label={copy.addLabel}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading || atCap}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-bg-card text-sm font-medium text-text-secondary cursor-pointer hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {uploading ? "Uploading…" : copy.addLabel}
      </button>
    </div>
  );
}
