'use client'

import { PAGINATION_UI_CONFIG } from '@/app/lib/config/paginationUi'
import { AppPagination } from './AppPagination'

interface PageNavigatorProps {
  /** 1-based current page. */
  page: number
  /** Total pages (page-model APIs return this). */
  totalPages: number
  /** Total items (for the "Showing x–y of total" line). */
  total: number
  /** Items per page. */
  pageSize: number
  /** Jump to a specific page. */
  onChange: (page: number) => void
}

/**
 * Shared specific-page navigator for page-model surfaces (leaderboard, blog).
 * Wraps AppPagination (prev / numbered pages with ellipsis / next + count)
 * with the config-driven accessible page label. Cursor-model surfaces use
 * ViewMoreButton instead — cursor windows cannot address specific pages.
 */
export function PageNavigator({ page, totalPages, total, pageSize, onChange }: PageNavigatorProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label={PAGINATION_UI_CONFIG.navigator.pageLabel(page, totalPages)} className="py-4">
      <AppPagination current={page} total={total} pageSize={pageSize} onChange={onChange} />
    </nav>
  )
}
