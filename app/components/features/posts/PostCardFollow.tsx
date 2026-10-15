"use client"

import { FollowButton } from "@/app/components/features/suggestions/FollowButton"
import { useFollowStatus } from "@/app/lib/hooks/useFollowStatus"
import { POST_FOLLOW_CONFIG } from "@/app/lib/config/postFollow"

interface PostCardFollowProps {
  /** Post author's user id. */
  authorId: string | null | undefined
  /** Viewer's user id (null for guests — tap then prompts sign-in). */
  viewerId: string | null | undefined
  className?: string
}

/**
 * Inline quick-follow affordance for post-card headers (Sprint 59).
 * Renders beside the author identity: icon-only on mobile, Follow text on
 * desktop. Hidden on the viewer's own posts and (directive preference) on
 * authors the viewer already follows. Renders nothing until there is an
 * author to follow; while status loads the safe default (follow button)
 * shows, and a tap re-checks server-side.
 */
export function PostCardFollow({ authorId, viewerId, className = "" }: PostCardFollowProps) {
  const { following, markFollowed } = useFollowStatus(authorId, viewerId)

  if (!authorId) return null
  if (POST_FOLLOW_CONFIG.hideOnOwnPost && viewerId && authorId === viewerId) return null
  if (POST_FOLLOW_CONFIG.hideWhenFollowing && following === true) return null

  return (
    <FollowButton
      userId={authorId}
      variant="responsive"
      initialFollowing={following === true}
      hideWhenFollowing={POST_FOLLOW_CONFIG.hideWhenFollowing}
      onFollowed={markFollowed}
      className={className}
    />
  )
}
