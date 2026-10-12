"use client"

import { useState, useContext } from "react"
import { AuthContext } from "@/app/providers/AuthProvider"
import { toastService } from "@/app/lib/services/toastService"
import { DELETED_USER_COPY, isVisibleUser } from "@/app/lib/config/userVisibility"

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
}

export function FollowButton({ userId, className = "", onFollowed, target }: FollowButtonProps) {
  const auth = useContext(AuthContext)
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

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
