'use client'

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils/cn'

type TagVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'muted'
type TagSize = 'xs' | 'sm' | 'default'

interface AppTagProps {
  variant?: TagVariant
  size?: TagSize
  icon?: LucideIcon
  removable?: boolean
  onRemove?: () => void
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<TagVariant, string> = {
  default: 'bg-bg-elevated text-text-secondary',
  primary: 'bg-primary-muted text-primary',
  success: 'bg-success text-success-text',
  warning: 'bg-warning text-warning-text',
  error: 'bg-error text-error-text',
  muted: 'bg-bg-elevated text-text-muted',
}

const sizeClasses: Record<TagSize, string> = {
  xs: 'px-2 py-0.5',
  sm: 'px-2.5 py-1',
  default: 'px-3 py-1',
}

export function AppTag({
  variant = 'default',
  size = 'default',
  icon: Icon,
  removable = false,
  onRemove,
  children,
  className,
}: AppTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 radius-pill font-medium text-xs leading-none whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {Icon && <Icon size={12} />}
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-circle p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-base"
          aria-label="Remove"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
