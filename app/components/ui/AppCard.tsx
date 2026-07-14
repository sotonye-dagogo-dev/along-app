'use client'

import { cn } from '@/app/lib/utils/cn'

type CardVariant = 'default' | 'elevated' | 'glass' | 'flat' | 'suggestion'

interface AppCardProps {
  variant?: CardVariant
  hover?: boolean
  className?: string
  children: React.ReactNode
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-bg-card border border-border shadow-sm radius-lg',
  elevated: 'bg-bg-card shadow-md radius-lg',
  glass: 'glass radius-xl',
  flat: 'bg-bg-elevated border border-border radius-lg',
  suggestion: 'bg-primary-muted border border-border shadow-sm border-l-4 border-l-primary',
}

export function AppCard({
  variant = 'default',
  hover = false,
  className,
  children,
}: AppCardProps) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        hover && 'transition-all duration-base hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  )
}
