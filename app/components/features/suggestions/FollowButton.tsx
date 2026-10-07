"use client"

import { useState, useContext } from "react"
import { UserPlus } from "lucide-react"
import { AuthContext } from "@/app/providers/AuthProvider"
import { toastService } from "@/app/lib/services/toastService"

interface FollowButtonProps {
  userId: string
  className?: string
  /** Called after a successful follow (e.g. to remove from a suggestion list). */
  onFollowed?: () => void
}

export function FollowButton({ userId, className = "", onFollowed }: FollowButtonProps) {
  const auth = useContext(AuthContext)
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

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
