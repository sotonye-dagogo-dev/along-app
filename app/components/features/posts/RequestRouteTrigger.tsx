"use client"

import { REQUEST_ROUTE_TRIGGER_CONFIG } from "@/app/lib/config"

interface RequestRouteTriggerProps {
  onClick: () => void
  className?: string
}

/**
 * Query-style trigger for the request-route flow.
 * Tagline (tooltip) + aria-label come from routeRequest config.
 *
 * Sprint 59: the visible "Request a route" text lives INSIDE the button
 * (below the icon on small screens, beside it on larger ones) so the text
 * performs the action as part of the button — not a separate element.
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
      className={`${REQUEST_ROUTE_TRIGGER_CONFIG.buttonClass} ${className}`}
    >
      <Icon size={16} className="shrink-0" aria-hidden />
      <span className={REQUEST_ROUTE_TRIGGER_CONFIG.mobileLabelClass} aria-hidden>
        {REQUEST_ROUTE_TRIGGER_CONFIG.label}
      </span>
      <span className={REQUEST_ROUTE_TRIGGER_CONFIG.desktopLabelClass} aria-hidden>
        {REQUEST_ROUTE_TRIGGER_CONFIG.shortLabel}
      </span>
    </button>
  )
}
