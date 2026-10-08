"use client"

import { REQUEST_ROUTE_TRIGGER_CONFIG } from "@/app/lib/config"

interface RequestRouteTriggerProps {
  onClick: () => void
  className?: string
}

/**
 * Query-style icon trigger for the request-route flow.
 * Tagline (tooltip) + aria-label come from routeRequest config.
 */
export function RequestRouteTrigger({ onClick, className = "" }: RequestRouteTriggerProps) {
  const Icon = REQUEST_ROUTE_TRIGGER_CONFIG.icon
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={REQUEST_ROUTE_TRIGGER_CONFIG.tagline}
      aria-label={REQUEST_ROUTE_TRIGGER_CONFIG.ariaLabel}
      className={`inline-flex items-center justify-center w-8 h-8 radius-md border border-border bg-bg-elevated text-text-secondary cursor-pointer font-sans transition-colors duration-fast hover:bg-primary-muted hover:text-primary hover:border-primary-muted shrink-0 ${className}`}
    >
      <Icon size={16} />
    </button>
  )
}
