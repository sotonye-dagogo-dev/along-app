'use client'

import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { AppDropdown, type DropdownItem } from './AppDropdown'
import { ADMIN_TABLE_ACTIONS_META } from '@/app/lib/config/admin'

/**
 * Metadata-driven row-actions dropdown for tables.
 *
 * Replaces direct per-row button rendering (which elongates rows and invites
 * mis-taps) with one compact trigger. Per-action `className` is preserved
 * inside the menu so bg/text colors survive the move into the dropdown.
 * Non-breaking additive component — existing direct rendering keeps working.
 */
export interface TableRowAction extends Omit<DropdownItem, 'onClick'> {
  id: string
  onSelect?: () => void
  href?: string
}

interface AppTableRowActionsProps {
  actions: TableRowAction[]
  align?: 'start' | 'end'
  ariaLabel?: string
  emptyLabel?: string
}

function toDropdownItems(actions: TableRowAction[]): DropdownItem[] {
  return actions.map((a) => ({
    label: a.label,
    icon: a.icon,
    variant: a.variant,
    className: a.className,
    disabled: a.disabled,
    disabledReason: a.disabledReason,
    title: a.title,
    onClick: a.disabled
      ? undefined
      : () => {
          try {
            if (a.href && typeof window !== 'undefined') {
              window.location.href = a.href
              return
            }
            a.onSelect?.()
          } catch {
            /* never throw from a menu tap */
          }
        },
  }))
}

export function AppTableRowActions({
  actions,
  align = (ADMIN_TABLE_ACTIONS_META.align as 'start' | 'end') ?? 'end',
  ariaLabel = ADMIN_TABLE_ACTIONS_META.triggerAriaLabel,
  emptyLabel = ADMIN_TABLE_ACTIONS_META.emptyLabel,
}: AppTableRowActionsProps) {
  const items = React.useMemo(() => {
    try {
      return toDropdownItems(Array.isArray(actions) ? actions : [])
    } catch {
      return [] as DropdownItem[]
    }
  }, [actions])

  if (items.length === 0) {
    return <span className="text-[10px] text-text-muted">{emptyLabel}</span>
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <AppDropdown
        align={align}
        items={items}
        ariaLabel={ariaLabel}
        trigger={
          <span
            aria-hidden="true"
            className="w-8 h-8 radius-md border border-border bg-bg-base text-text-secondary hover:text-text-primary hover:bg-bg-elevated cursor-pointer grid place-items-center transition-colors duration-fast"
          >
            <MoreHorizontal size={16} />
          </span>
        }
      />
    </span>
  )
}

export type { AppTableRowActionsProps }
