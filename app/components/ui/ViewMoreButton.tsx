'use client'

import { ChevronDown, Loader2 } from 'lucide-react'
import { PAGINATION_UI_CONFIG } from '@/app/lib/config/paginationUi'

interface ViewMoreButtonProps {
  /** Append the next window. */
  onViewMore: () => void
  /** True while the next window is fetching. */
  loading?: boolean
  /** Items currently shown (for the count line). */
  shown: number
  /** Known total, or null when the API is open-ended (cursor model). */
  total?: number | null
  /** Hide entirely (e.g. no next window). */
  hasMore?: boolean
}

/**
 * Shared "View more" control for cursor-paginated surfaces (notifications,
 * search, comments, reviews, admin lists). Cursor windows are unstable under
 * concurrent writes by design, so this appends forward only — no prev/page
 * retrofit. Count copy comes from PAGINATION_UI_CONFIG.
 */
export function ViewMoreButton({ onViewMore, loading = false, shown, total = null, hasMore = true }: ViewMoreButtonProps) {
  if (!hasMore) return null
  return (
    <div className="flex flex-col items-center gap-1.5 py-4">
      <p className="text-xs text-text-muted" role="status">
        {PAGINATION_UI_CONFIG.viewMore.countLine(shown, total)}
      </p>
      <button
        type="button"
        onClick={onViewMore}
        disabled={loading}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-border bg-bg-card text-sm font-semibold text-text-primary cursor-pointer hover:border-primary hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden />
            {PAGINATION_UI_CONFIG.viewMore.loadingLabel}
          </>
        ) : (
          <>
            <ChevronDown size={16} aria-hidden />
            {PAGINATION_UI_CONFIG.viewMore.label}
          </>
        )}
      </button>
    </div>
  )
}
