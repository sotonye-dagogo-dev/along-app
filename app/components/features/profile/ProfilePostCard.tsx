'use client'

import { useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import PostCard from "@/app/components/features/posts/PostCard"
import { AppModal } from "@/app/components/ui/AppModal"
import { CommentInput, CommentList } from "@/app/components/features/comments"
import { POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { toastService } from "@/app/lib/services/toastService"
import { useAuth } from "@/app/hooks/useAuth"

interface ProfilePostCardComment {
  id: string
  text: string
  createdAt: string
  user: { id: string; userName: string; firstName: string; lastName: string; avatar?: string | null }
}

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
  const [commentOpen, setCommentOpen] = useState(false)
  const [comments, setComments] = useState<ProfilePostCardComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const handleLike = useCallback(
    async (postId: string, liked: boolean) => {
      if (liked) toastService.success("Route liked!")
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

  const handleDislike = useCallback(async (postId: string) => {
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
    try {
      await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" })
    } catch {
      toastService.error("Failed to update bookmark")
    }
  }, [])

  const handleShare = useCallback(async (postId: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/posts/${postId}` : `/posts/${postId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url }).catch(() => {})
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement("textarea")
        ta.value = url
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      toastService.success(POST_ACTIONS_CONFIG.copySuccess)
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.copyError)
    }
  }, [post.title])

  const openComments = useCallback(
    async (postId: string) => {
      if (!requireAuth("comment on routes")) return
      setCommentOpen(true)
      setCommentsLoading(true)
      try {
        const res = await fetch(`/api/posts/${postId}/comments`)
        if (res.ok) {
          const data = await res.json()
          setComments(data.comments ?? [])
        }
      } catch {
        // Modal still opens with the expand-post fallback below.
      } finally {
        setCommentsLoading(false)
      }
    },
    [requireAuth],
  )

  const handleCommentSubmit = useCallback(
    async (text: string) => {
      try {
        const res = await fetch(`/api/posts/${post.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.comment) setComments((prev) => [data.comment, ...prev])
        }
      } catch {
        toastService.error("Failed to post comment")
      }
    },
    [post.id],
  )

  const viewerName = viewer ? `${(viewer as { firstName?: string }).firstName ?? ""} ${(viewer as { lastName?: string }).lastName ?? ""}`.trim() || "You" : "You"

  return (
    <>
      <PostCard
        post={post}
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
      <AppModal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        size="default"
        title="Comments"
        subtitle={post.title}
      >
        <CommentInput userName={viewerName} onSubmit={handleCommentSubmit} />
        {commentsLoading ? (
          <p className="text-sm text-text-muted py-4 text-center">Loading comments…</p>
        ) : (
          <CommentList comments={comments} postId={post.id} onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))} />
        )}
        <div className="pt-3 mt-1 border-t border-border">
          <Link
            href={`/posts/${post.id}`}
            className="text-sm font-semibold text-primary no-underline hover:underline"
          >
            Expand post to view full discussion →
          </Link>
        </div>
      </AppModal>
    </>
  )
}
