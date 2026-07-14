'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils/cn'

type ModalSize = 'sm' | 'default' | 'lg' | 'xl' | 'fullscreen'

interface AppModalProps {
  open: boolean
  onClose: () => void
  size?: ModalSize
  title?: string
  subtitle?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  destructive?: boolean
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-[400px]',
  default: 'max-w-[520px]',
  lg: 'max-w-[680px]',
  xl: 'max-w-[800px]',
  fullscreen: 'max-w-full max-h-full rounded-none mx-0',
}

export function AppModal({
  open,
  onClose,
  size = 'default',
  title,
  subtitle,
  children,
  footer,
  destructive,
}: AppModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleEscape)
    contentRef.current?.focus()
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleEscape])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-bg-overlay z-50 flex items-start justify-center pt-20 overflow-y-auto"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'bg-bg-card radius-xl shadow-xl animate-fade-slide-up w-full mx-4 outline-none relative',
          sizeClasses[size],
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 rounded-circle p-1.5 hover:bg-bg-elevated transition-colors duration-base text-text-secondary hover:text-text-primary"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {(title || subtitle) && (
          <div className="px-6 pt-6 pb-0 pr-14">
            {title && (
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            )}
            {subtitle && (
              <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {children && <div className="p-6">{children}</div>}

        {footer && (
          <div
            className={cn(
              'border-t border-border px-6 py-4 flex gap-2',
              destructive ? 'justify-between' : 'justify-end',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
