"use client";

import { FileText, Trash2, ArrowRight } from "lucide-react";
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts";
import type { RouteDraft } from "@/app/lib/services/routeDraftsService";

interface RouteDraftsPanelProps {
  drafts: RouteDraft[];
  activeDraftId?: string | null;
  onRestore: (draft: RouteDraft) => void;
  onDelete: (id: string) => void;
}

/**
 * Config-driven saved-drafts list for the share-route flow.
 * Restore loads the draft back into the composer; continuing means the user
 * reviews the restored fields and taps Share Route to upload.
 */
export function RouteDraftsPanel({ drafts, activeDraftId, onRestore, onDelete }: RouteDraftsPanelProps) {
  if (drafts.length === 0) {
    return <p className="text-xs text-text-muted px-1 py-2">{ROUTE_DRAFTS_CONFIG.emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={ROUTE_DRAFTS_CONFIG.panelTitle}>
      {drafts.map((draft) => {
        const isActive = draft.id === activeDraftId;
        const stepCount = draft.steps.length;
        const title = draft.title.trim() || "Untitled route";
        let savedLabel = draft.savedAt;
        try {
          savedLabel = new Date(draft.savedAt).toLocaleString();
        } catch {
          /* keep raw ISO */
        }
        return (
          <li
            key={draft.id}
            className={`flex items-center gap-2.5 px-3 py-2.5 border radius-lg bg-bg-elevated transition-colors duration-fast ${
              isActive ? "border-primary" : "border-border"
            }`}
          >
            <span className="w-8 h-8 rounded-circle bg-primary-muted text-primary flex items-center justify-center shrink-0">
              <FileText size={15} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-text-primary truncate">{title}</span>
              <span className="block text-[11px] text-text-muted truncate">
                {stepCount} {stepCount === 1 ? "step" : "steps"}
                {draft.images.length > 0 ? ` · ${draft.images.length} image${draft.images.length === 1 ? "" : "s"}` : ""}
                {" · "}
                <time dateTime={draft.savedAt}>{savedLabel}</time>
                {isActive ? " · editing" : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onRestore(draft)}
              title={ROUTE_DRAFTS_CONFIG.continueLabel}
              aria-label={`${ROUTE_DRAFTS_CONFIG.restoreLabel}: ${title}`}
              className="inline-flex items-center gap-1 h-8 px-2.5 radius-md border border-border bg-bg-card text-xs font-semibold text-primary cursor-pointer font-sans hover:border-primary hover:bg-primary-muted transition-colors duration-fast shrink-0"
            >
              <ArrowRight size={13} />
              <span className="hidden sm:inline">{ROUTE_DRAFTS_CONFIG.continueLabel}</span>
              <span className="sm:hidden">{ROUTE_DRAFTS_CONFIG.restoreLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              title={ROUTE_DRAFTS_CONFIG.deleteLabel}
              aria-label={`${ROUTE_DRAFTS_CONFIG.deleteLabel}: ${title}`}
              className="inline-flex items-center justify-center w-8 h-8 radius-md border-none bg-transparent text-text-muted cursor-pointer hover:text-error-text hover:bg-error transition-colors duration-fast shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
