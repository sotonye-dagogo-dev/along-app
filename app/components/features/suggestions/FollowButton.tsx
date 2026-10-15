"use client"

import { useEffect, useState, useContext } from "react"
import { AuthContext } from "@/app/providers/AuthProvider"
import { toastService } from "@/app/lib/services/toastService"
import { DELETED_USER_COPY, isVisibleUser } from "@/app/lib/config/userVisibility"
import { POST_FOLLOW_CONFIG } from "@/app/lib/config/postFollow"

interface FollowButtonProps {
  userId: string
  className?: string
  /** Called after a successful follow (e.g. to remove from a suggestion list). */
  onFollowed?: () => void
  /**
   * Visibility of the target account. Deleted/archived accounts render a
   * disabled Unavailable button instead of a follow action (re-enabled if the
   * account is restored). Optional — absent means visible (legacy callers).
    */
  target?: { isDeleted?: boolean | null; deletionScheduledFor?: string | Date | null } | null
  /**
   * Seed for the followed state (e.g. from `useFollowStatus`). Lets post
   * cards render the correct affordance on first paint instead of flashing
   * "Follow" for already-followed authors. Defaults to false (legacy).
   */
  initialFollowing?: boolean
  /**
   * When true, the button unmounts once followed (Sprint 59 directive
   * preference for post cards: no affordance on already-followed authors).
   * Defaults to false (legacy callers keep the disabled "Following" chip).
   */
  hideWhenFollowing?: boolean
  /**
   * Rendering variant: "text" (legacy Follow/Following), "icon" (mobile
   * UserPlus/UserCheck icon only), "responsive" (icon on mobile + text on
   * desktop, directive layout). Defaults to "text" (legacy).
   */
  variant?: "text" | "icon" | "responsive"
}

export function FollowButton({ userId, className = "", onFollowed, target, initialFollowing = false, hideWhenFollowing = false, variant = "text" }: FollowButtonProps) {
  const auth = useContext(AuthContext)
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  // Seed from cached follow-status when it resolves after mount (post
  // cards mount before the status read settles). One-way only — a fresh
  // in-session follow is never overwritten back to false.
  useEffect(() => {
    if (initialFollowing) setFollowing(true)
  }, [initialFollowing])

  // Directive preference for post cards: no affordance on already-followed
  // authors (or momentarily after following). Legacy surfaces keep the chip.
  if (hideWhenFollowing && following) return null

  // Deleted/archived accounts cannot be followed until restored. The server
  // also guards (410) — this is the user-facing affordance for it.
  if (target && !isVisibleUser(target)) {
    return (
      <button
        type="button"
        disabled
        title={DELETED_USER_COPY.followUnavailableTitle}
        aria-label={DELETED_USER_COPY.followUnavailableTitle}
        aria-disabled="true"
        className={`shrink-0 h-7 px-3 rounded-md text-xs font-semibold border transition-colors font-sans disabled:cursor-not-allowed bg-bg-elevated border-border text-text-muted opacity-60 ${className}`}
      >
        {DELETED_USER_COPY.followUnavailableLabel}
      </button>
    )
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || following) return
    if (!auth?.requireAuth("follow users")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" })
      if (res.ok) {
        setFollowing(true)
        onFollowed?.()
      } else {
        const body = await res.json().catch(() => ({}))
        toastService.error(body?.error ?? "Could not follow user. Please try again.")
      }
    } catch {
      toastService.error("Network error. Please check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  // Responsive variant: icon-only button on mobile + text button on
  // desktop (only one is visible at a time via responsive classes).
  if (variant === "icon" || variant === "responsive") {
    const Icon = following ? POST_FOLLOW_CONFIG.followingIcon : POST_FOLLOW_CONFIG.followIcon
    const iconButton = (
      <button
        onClick={handleClick}
        disabled={following || busy}
        className={`${variant === "icon" ? POST_FOLLOW_CONFIG.iconStandaloneClass : POST_FOLLOW_CONFIG.iconButtonClass} ${className}`}
        aria-label={following ? POST_FOLLOW_CONFIG.followingLabel : POST_FOLLOW_CONFIG.followLabel}
        title={following ? POST_FOLLOW_CONFIG.followingLabel : POST_FOLLOW_CONFIG.followLabel}
      >
        <Icon size={POST_FOLLOW_CONFIG.iconSize} />
      </button>
    )
    if (variant === "icon") return iconButton
    return (
      <>
        {iconButton}
        <button
          onClick={handleClick}
          disabled={following || busy}
          className={`${POST_FOLLOW_CONFIG.textButtonClass} ${className}`}
          aria-label={following ? POST_FOLLOW_CONFIG.followingLabel : POST_FOLLOW_CONFIG.followLabel}
        >
          {following ? POST_FOLLOW_CONFIG.followingLabel : busy ? "…" : POST_FOLLOW_CONFIG.followLabel}
        </button>
      </>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={following || busy}
      className={`shrink-0 h-7 px-3 rounded-md text-xs font-semibold border transition-colors cursor-pointer font-sans disabled:cursor-default ${following ? "bg-bg-elevated border-border text-text-secondary" : "bg-transparent text-primary border-primary hover:bg-primary hover:text-white"} ${className}`}
      aria-label={following ? "Following" : "Follow user"}
    >
      {following ? "Following" : busy ? "…" : "Follow"}
    </button>
  )
}
