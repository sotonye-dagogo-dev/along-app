'use client'

import { useState } from 'react'
import { cn } from '@/app/lib/utils/cn'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface AppTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: TooltipPosition
  className?: string
}

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
}

export function AppTooltip({
  content,
  children,
  position = 'top',
  className,
}: AppTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 bg-bg-card border border-border radius-lg shadow-lg px-3 py-2 text-sm text-text-primary whitespace-nowrap animate-scale-in pointer-events-none',
            positionClasses[position],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
