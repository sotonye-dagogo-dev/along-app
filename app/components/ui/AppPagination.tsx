'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/utils/cn'

interface AppPaginationProps {
  current: number
  total: number
  pageSize?: number
  onChange: (page: number) => void
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) {
    pages.push('...')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push('...')
  }

  pages.push(total)

  return pages
}

export function AppPagination({
  current,
  total,
  pageSize = 20,
  onChange,
}: AppPaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const startItem = (current - 1) * pageSize + 1
  const endItem = Math.min(current * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-text-secondary">
        Showing {startItem}&ndash;{endItem} of {total}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          className={cn(
            'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm transition-colors duration-base',
            'hover:bg-bg-elevated text-text-secondary',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers(current, totalPages).map((page, index) =>
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 py-1 text-sm text-text-muted"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors duration-base',
                page === current
                  ? 'bg-primary text-text-inverse'
                  : 'hover:bg-bg-elevated text-text-secondary',
              )}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(current + 1)}
          disabled={current >= totalPages}
          className={cn(
            'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm transition-colors duration-base',
            'hover:bg-bg-elevated text-text-secondary',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
