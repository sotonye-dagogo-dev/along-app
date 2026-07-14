'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils/cn'
import { EMPTY_STATES } from '@/app/lib/config'
import type { EmptyStateConfig } from '@/app/lib/types'

type EmptyStateVariant = 'sm' | 'default' | 'lg'

interface AppEmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
  variant?: EmptyStateVariant
  preset?: string
}

const variantClasses: Record<EmptyStateVariant, { container: string; iconContainer: string; iconSize: number }> = {
  sm: { container: 'min-h-[160px] py-8', iconContainer: 'p-2', iconSize: 32 },
  default: { container: 'min-h-[240px] py-12', iconContainer: 'p-3', iconSize: 48 },
  lg: { container: 'min-h-[360px] py-16', iconContainer: 'p-4', iconSize: 64 },
}

export function AppEmptyState({
  icon: IconProp,
  title: titleProp,
  description: descriptionProp,
  actionLabel: actionLabelProp,
  actionHref: actionHrefProp,
  variant = 'default',
  preset,
}: AppEmptyStateProps) {
  const presetConfig: Partial<EmptyStateConfig> | undefined = preset
    ? EMPTY_STATES[preset]
    : undefined

  const Icon = IconProp ?? presetConfig?.icon
  const title = titleProp ?? presetConfig?.title ?? ''
  const description = descriptionProp ?? presetConfig?.description ?? ''
  const actionLabel = actionLabelProp ?? presetConfig?.actionLabel
  const actionHref = actionHrefProp ?? presetConfig?.actionHref

  const { container, iconContainer, iconSize } = variantClasses[variant]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        container,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'bg-bg-elevated rounded-xl text-text-muted mb-3',
            iconContainer,
          )}
        >
          <Icon size={iconSize} />
        </div>
      )}

      {title && (
        <h3 className="text-base font-semibold text-text-primary mb-2">
          {title}
        </h3>
      )}

      {description && (
        <p className="text-sm text-text-secondary mb-6 max-w-xs">
          {description}
        </p>
      )}

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 transition-opacity duration-base"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
