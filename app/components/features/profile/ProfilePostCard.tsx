'use client'

import { useCallback, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import PostCard from "@/app/components/features/posts/PostCard"
import { PostCommentsModal } from "@/app/components/features/comments"
import { POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { sharePostLink } from "@/app/lib/services/postShareService"
import { toastService } from "@/app/lib/services/toastService"
import { feedStream } from "@/app/lib/streams/feedStream"
import { useAuth } from "@/app/hooks/useAuth"

interface ProfilePostCardProps {
  // Full post shape from GET /api/posts (PostCard-compatible). Minimal
  // projections are normalised upstream so the card always has routes/images.
  post: React.ComponentProps<typeof PostCard>["post"]
  onRemoved?: (postId: string) => void
}

/**
 * Interactive post card for profile tabs.
 * Like / dislike / bookmark / share all work in place; comment opens a
 * comment modal (preferred) with an "expand post" fallback link.
 */
export function ProfilePostCard({ post, onRemoved }: ProfilePostCardProps) {
  const router = useRouter()
  const { user: viewer, requireAuth } = useAuth()
  const [commentPostId, setCommentPostId] = useState<string | null>(null)

  // Seed from the shared feed interaction cache so a like applied on the
  // feed is already reflected when the same post renders in a profile tab
  // (and vice versa) — even before the tab list revalidates.
  const syncedPost = useMemo(() => {
    try {
      const cached = feedStream.interactionCache$.value.get(post.id) as
        | { _isLiked?: boolean; _isDisliked?: boolean; _isBookmarked?: boolean; likes?: number; dislikes?: number }
        | undefined;
      if (!cached) return post;
      return {
        ...post,
        _isLiked: cached._isLiked ?? (post as { _isLiked?: boolean })._isLiked,
        _isDisliked: cached._isDisliked ?? (post as { _isDisliked?: boolean })._isDisliked,
        _isBookmarked: cached._isBookmarked ?? (post as { _isBookmarked?: boolean })._isBookmarked,
        likes: cached.likes ?? (post as { likes: number }).likes,
        dislikes: cached.dislikes ?? (post as { dislikes: number }).dislikes,
      };
    } catch {
      return post;
    }
  }, [post])

  const handleLike = useCallback(
    async (postId: string, liked: boolean) => {
      if (liked) toastService.success("Route liked!")
      // Mirror into the shared cache so the feed shows the same state.
      try { feedStream.applyInteraction({ postId, type: "like", value: liked }); } catch { /* ignore */ }
      try {
        // The like API toggles on repeat of the same type, so always send
        // LIKE here (un-like is a second LIKE that toggles off).
        await fetch(`/api/posts/${postId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "LIKE" }),
        })
      } catch {
        toastService.error("Failed to like route")
      }
    },
    [],
  )

  const handleDislike = useCallback(async (postId: string, disliked: boolean) => {
    try {
      feedStream.applyInteraction({ postId, type: "dislike", value: disliked });
    } catch { /* ignore */ }
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DISLIKE" }),
      })
    } catch {
      toastService.error("Failed to dislike route")
    }
  }, [])

  const handleBookmark = useCallback(async (postId: string, bookmarked: boolean) => {
    if (bookmarked) toastService.success("Route bookmarked!")
    else toastService.success("Bookmark removed")
    try { feedStream.applyInteraction({ postId, type: "bookmark", value: bookmarked }); } catch { /* ignore */ }
    try {
      await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" })
    } catch {
      toastService.error("Failed to update bookmark")
    }
  }, [])

  const handleShare = useCallback(async (postId: string) => {
    // Shared service: Web Share → clipboard → legacy fallback. Behaviour is
    // identical to the previous inline version, now deduplicated.
    const outcome = await sharePostLink(postId, post.title || POST_ACTIONS_CONFIG.shareTitleDefault)
    if (outcome.ok) {
      if (outcome.method !== "web-share") toastService.success(POST_ACTIONS_CONFIG.copySuccess)
    } else {
      toastService.error(POST_ACTIONS_CONFIG.copyError)
    }
  }, [post.title])

  const openComments = useCallback(
    async (postId: string) => {
      if (!requireAuth("comment on routes")) return
      setCommentPostId(postId)
    },
    [requireAuth],
  )

  const viewerInfo = {
    userName: (viewer as { userName?: string } | null)?.userName ?? "guest",
    displayName:
      `${(viewer as { firstName?: string } | null)?.firstName ?? ""} ${(viewer as { lastName?: string } | null)?.lastName ?? ""}`.trim() || "You",
    avatar: (viewer as { avatar?: string } | null)?.avatar ?? null,
    avatarConfig: (viewer as { avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null } | null)?.avatarConfig ?? null,
  }

  return (
    <>
      <PostCard
        post={syncedPost}
        onLike={handleLike}
        onDislike={handleDislike}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onComment={openComments}
        onRespond={(p) => router.push(`/posts/${(p as { id: string }).id}`)}
        onDeleted={(postId) => onRemoved?.(postId)}
        onArchivedChanged={(postId, archived) => {
          if (archived) onRemoved?.(postId)
        }}
      />
      <PostCommentsModal
        open={commentPostId !== null}
        postId={commentPostId}
        postTitle={post.title}
        viewer={viewerInfo}
        onClose={() => setCommentPostId(null)}
      />
    </>
  )
}
