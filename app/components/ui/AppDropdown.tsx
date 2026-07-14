'use client'

import { useState, useRef, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils/cn'

interface DropdownItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  variant?: 'default' | 'destructive'
}

interface AppDropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'start' | 'end'
}

export function AppDropdown({
  trigger,
  items,
  align = 'start',
}: AppDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleItemClick = (item: DropdownItem) => {
    item.onClick?.()
    setIsOpen(false)
  }

  return (
    <div ref={menuRef} className="relative inline-flex">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 bg-bg-card border border-border radius-lg shadow-lg py-1 min-w-[160px]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleItemClick(item)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer transition-colors duration-base',
                  item.variant === 'destructive' && 'text-error-text',
                )}
              >
                {Icon && <Icon size={16} />}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
