'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'on-primary' | 'destructive' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-text-inverse hover:bg-primary-dark active:bg-primary-dark',
  secondary: 'bg-transparent border-2 border-primary text-primary hover:bg-primary-muted active:bg-primary-muted',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated active:bg-bg-elevated',
  // For use on the brand gradient (landing hero/CTA): deliberately explicit
  // light-on-dark tokens so the primary/secondary variants never fight it.
  'on-primary': 'bg-transparent border border-white/40 text-white hover:bg-white/10 active:bg-white/20',
  destructive: 'bg-error-text text-text-inverse hover:opacity-90 active:opacity-90',
  icon: 'bg-transparent text-text-secondary hover:bg-bg-elevated active:bg-bg-elevated rounded-circle',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-[32px] px-3 text-sm gap-1.5',
  md: 'h-[40px] px-4 text-sm gap-2',
  lg: 'h-[48px] px-6 text-base gap-2.5',
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-[32px] w-[32px]',
  md: 'h-[40px] w-[40px]',
  lg: 'h-[48px] w-[48px]',
}

const loaderSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
}

const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      className = '',
      children,
      icon,
      type = 'button',
      fullWidth = false,
      ...props
    },
    ref
  ) => {
    const isIconOnly = variant === 'icon'

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium rounded-sm transition-all duration-fast cursor-pointer
          ${variantStyles[variant]}
          ${isIconOnly ? iconSizeStyles[size] : sizeStyles[size]}
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 size={loaderSizes[size]} className="animate-spin-slow shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {!isIconOnly && children}
      </button>
    )
  }
)

AppButton.displayName = 'AppButton'

export { AppButton }
