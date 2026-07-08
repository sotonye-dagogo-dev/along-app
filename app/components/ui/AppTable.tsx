'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => React.ReactNode
  sortable?: boolean
}

interface AppTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowHref?: string | ((row: T) => string)
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  stickyHeader?: boolean
  emptyState?: React.ReactNode
  isLoading?: boolean
  loadingSkeleton?: React.ReactNode
  className?: string
  rowKey?: string | ((row: T) => string)
}

function getRowKey<T>(row: T, index: number, rowKey?: string | ((row: T) => string)): string {
  if (typeof rowKey === 'function') return rowKey(row)
  if (typeof rowKey === 'string') return String((row as Record<string, unknown>)[rowKey])
  return String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).key ?? index)
}

interface SkeletonRowProps {
  columns: ReadonlyArray<{ key: string }>
  selectable?: boolean
}

const SkeletonRow = React.memo(function SkeletonRow({ columns, selectable }: SkeletonRowProps) {
  return (
    <tr className="h-14 border-b border-border">
      {selectable && (
        <td className="p-3">
          <div className="w-4 h-4 rounded bg-bg-elevated animate-shimmer" style={{ background: 'linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-border) 50%, var(--color-bg-elevated) 75%)', backgroundSize: '200% 100%' }} />
        </td>
      )}
      {columns.map((col) => (
        <td key={col.key} className="p-3">
          <div className="h-3 rounded bg-bg-elevated animate-shimmer w-[60%]" style={{ background: 'linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-border) 50%, var(--color-bg-elevated) 75%)', backgroundSize: '200% 100%' }} />
        </td>
      ))}
    </tr>
  )
})

function TdLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <Link href={href} onClick={onClick} className="block w-full h-full">
      {children}
    </Link>
  )
}

function AppTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowHref,
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  stickyHeader = false,
  emptyState,
  isLoading = false,
  loadingSkeleton,
  className = '',
  rowKey,
}: AppTableProps<T>) {
  const router = useRouter()
  const [localSortKey, setLocalSortKey] = useState<string | null>(null)
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('asc')
  const lastClickedRef = useRef<number | null>(null)

  const isControlled = controlledSelectedKeys !== undefined

  const internalSelectedRef = useRef<Set<string>>(new Set())

  const resolvedSelected = isControlled ? controlledSelectedKeys! : internalSelectedRef.current

  const handleSort = useCallback(
    (key: string) => {
      if (localSortKey === key) {
        setLocalSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setLocalSortKey(key)
        setLocalSortDir('asc')
      }
    },
    [localSortKey]
  )

  const sortedData = useMemo(() => {
    if (!localSortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[localSortKey]
      const bVal = b[localSortKey]
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return localSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (aVal < bVal) return localSortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return localSortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, localSortKey, localSortDir])

  const notifySelection = useCallback(
    (keys: Set<string>) => {
      if (isControlled) {
        onSelectionChange?.(keys)
      } else {
        internalSelectedRef.current = keys
      }
    },
    [isControlled, onSelectionChange]
  )

  const toggleSelection = useCallback(
    (key: string, displayIndex: number, shiftKey: boolean) => {
      const next = new Set(resolvedSelected)
      if (shiftKey && lastClickedRef.current !== null) {
        const start = Math.min(lastClickedRef.current, displayIndex)
        const end = Math.max(lastClickedRef.current, displayIndex)
        const rangeKeys = sortedData.slice(start, end + 1).map((r, i) => getRowKey(r, start + i, rowKey))
        const alreadyAllSelected = rangeKeys.every((k) => next.has(k))
        for (const k of rangeKeys) {
          if (alreadyAllSelected) {
            next.delete(k)
          } else {
            next.add(k)
          }
        }
      } else {
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
      }
      lastClickedRef.current = displayIndex
      notifySelection(next)
    },
    [sortedData, resolvedSelected, rowKey, notifySelection]
  )

  const toggleAll = useCallback(() => {
    const allKeys = sortedData.map((row, i) => getRowKey(row, i, rowKey))
    const allSelected = allKeys.every((k) => resolvedSelected.has(k))
    const next = new Set(resolvedSelected)
    if (allSelected) {
      for (const k of allKeys) next.delete(k)
    } else {
      for (const k of allKeys) next.add(k)
    }
    notifySelection(next)
  }, [sortedData, resolvedSelected, rowKey, notifySelection])

  const skeletonRows = useMemo(() => {
    if (!isLoading) return null
    if (loadingSkeleton) return loadingSkeleton
    return Array.from({ length: 5 }, (_, i) => (
      <SkeletonRow key={`skel-${i}`} columns={columns} selectable={selectable} />
    ))
  }, [isLoading, loadingSkeleton, columns, selectable])

  const headerClass = stickyHeader ? 'sticky top-0 z-10' : ''

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead className={`bg-bg-elevated ${headerClass}`}>
          <tr>
            {selectable && (
              <th className="p-3 text-left w-10 border-b border-border-strong">
                <input
                  type="checkbox"
                  className="cursor-pointer accent-primary"
                  checked={sortedData.length > 0 && sortedData.every((row, i) => resolvedSelected.has(getRowKey(row, i, rowKey)))}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider border-b border-border-strong ${
                  col.sortable ? 'cursor-pointer select-none hover:text-text-primary transition-colors duration-base' : ''
                }`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    localSortKey === col.key ? (
                      localSortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ChevronsUpDown size={12} className="text-text-muted" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            skeletonRows
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-3">
                <div className="flex items-center justify-center min-h-[240px]">
                  {emptyState ?? (
                    <div className="text-center text-text-muted">
                      <p className="text-sm">No data available</p>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((row, displayIndex) => {
              const key = getRowKey(row, displayIndex, rowKey)
              const isSelected = resolvedSelected.has(key)
              const href = typeof rowHref === 'function' ? rowHref(row) : rowHref

              return (
                <tr
                  key={key}
                  className={`h-14 border-b border-border hover:bg-bg-elevated transition-colors duration-base ${
                    displayIndex % 2 !== 0 ? 'bg-bg-base/50' : ''
                  } ${isSelected ? 'bg-primary-muted' : ''} ${href ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    if (href && !(e.target as HTMLElement).closest('a, input, button, label')) {
                      router.push(href)
                    }
                  }}
                >
                  {selectable && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-primary"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelection(key, displayIndex, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="p-3 text-sm text-text-primary">
                      {href ? (
                        <TdLink href={href} onClick={(e) => e.stopPropagation()}>
                          {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                        </TdLink>
                      ) : (
                        col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')
                      )}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export { AppTable, SkeletonRow }
export type { AppTableProps, Column }
