'use client'

import { useCallback, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import PostCard from "@/app/components/features/posts/PostCard"
import { PostCommentsModal } from "@/app/components/features/comments"
import { POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { sharePostLink } from "@/app/lib/services/postShareService"
import { toastService } from "@/app/lib/services/toastService"
import { feedStream } from "@/app/lib/streams/feedStream"
import { useAuth } from "@/app/hooks/useAuth"

const ShareRouteModal = dynamic(() => import("@/app/components/features/posts/ShareRouteModal"), { ssr: false })
const RequestRouteModal = dynamic(() => import("@/app/components/features/posts/RequestRouteModal"), { ssr: false })

interface ProfilePostCardProps {
  // Full post shape from GET /api/posts (PostCard-compatible). Minimal
  // projections are normalised upstream so the card always has routes/images.
  post: React.ComponentProps<typeof PostCard>["post"]
  onRemoved?: (postId: string) => void
  /** Called after a successful in-place edit so the parent list can refresh. */
  onEdited?: (postId: string) => void
}

type AnyPost = Record<string, unknown> & { id: string; type?: string }

/**
 * Interactive post card for profile tabs, bookmarks page, and search.
 * Like / dislike / bookmark / share / menu (copy/edit/delete/archive/report)
 * all work in place; comment opens a comment modal (preferred) with an
 * "expand post" fallback link. Edit opens the matching composer in edit mode
 * so a ROUTE_REQUEST stays a request (nature preserved end-to-end).
 */
export function ProfilePostCard({ post, onRemoved, onEdited }: ProfilePostCardProps) {
  const router = useRouter()
  const { user: viewer, requireAuth } = useAuth()
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<AnyPost | null>(null)
  const [editRequest, setEditRequest] = useState<{ id: string; title: string; description: string; routes: unknown[]; tags: string[] } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [localPost, setLocalPost] = useState<React.ComponentProps<typeof PostCard>["post"] | null>(null)

  const livePost = localPost ?? post

  // Seed from the shared feed interaction cache so a like applied on the
  // feed is already reflected when the same post renders in a profile tab
  // (and vice versa) — even before the tab list revalidates.
  const syncedPost = useMemo(() => {
    try {
      const cached = feedStream.interactionCache$.value.get(livePost.id) as
        | { _isLiked?: boolean; _isDisliked?: boolean; _isBookmarked?: boolean; likes?: number; dislikes?: number }
        | undefined;
      if (!cached) return livePost;
      return {
        ...livePost,
        _isLiked: cached._isLiked ?? (livePost as { _isLiked?: boolean })._isLiked,
        _isDisliked: cached._isDisliked ?? (livePost as { _isDisliked?: boolean })._isDisliked,
        _isBookmarked: cached._isBookmarked ?? (livePost as { _isBookmarked?: boolean })._isBookmarked,
        likes: cached.likes ?? (livePost as { likes: number }).likes,
        dislikes: cached.dislikes ?? (livePost as { dislikes: number }).dislikes,
      };
    } catch {
      return livePost;
    }
  }, [livePost])

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
    const outcome = await sharePostLink(postId, (livePost as { title?: string }).title || POST_ACTIONS_CONFIG.shareTitleDefault)
    if (outcome.ok) {
      if (outcome.method !== "web-share") toastService.success(POST_ACTIONS_CONFIG.copySuccess)
    } else {
      toastService.error(POST_ACTIONS_CONFIG.copyError)
    }
  }, [livePost])

  const openComments = useCallback(
    async (postId: string) => {
      if (!requireAuth("comment on routes")) return
      setCommentPostId(postId)
    },
    [requireAuth],
  )

  /** Owner picked Edit — open the matching composer so post nature is preserved. */
  const handleEdit = useCallback((p: React.ComponentProps<typeof PostCard>["post"]) => {
    const typed = p as unknown as AnyPost
    if (typed.type === "ROUTE_REQUEST") {
      const steps = Array.isArray((typed as { routes?: unknown }).routes)
        ? ((typed as { routes: unknown[] }).routes as { location?: string; description?: string }[])
        : []
      setEditRequest({
        id: typed.id,
        title: (typed as { title?: string }).title ?? "",
        description: (typed as { description?: string }).description ?? "",
        routes: steps as unknown[],
        tags: ((typed as { tags?: string[] }).tags ?? []) as string[],
      })
      setEditPost(null)
      setShowShareModal(false)
      setShowRequestModal(true)
      return
    }
    setEditRequest(null)
    setEditPost(typed)
    setShowRequestModal(false)
    setShowShareModal(true)
  }, [])

  const handleEditSubmit = useCallback(async (postId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        try {
          const payload = await res.json().catch(() => null) as { message?: string; error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } | null
          const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation")
          toastService.error(firstRouteServerMessage(payload?.details, payload?.message ?? payload?.error ?? POST_ACTIONS_CONFIG.editError))
        } catch {
          toastService.error(POST_ACTIONS_CONFIG.editError)
        }
        return false
      }
      const payload = await res.json().catch(() => null) as { post?: Record<string, unknown> } | null
      const updated = payload?.post
      if (updated) {
        try { feedStream.updatePost(postId, updated as Parameters<typeof feedStream.updatePost>[1]) } catch { /* ignore */ }
        setLocalPost((prev) => ({ ...(prev ?? post), ...(updated as object) }) as React.ComponentProps<typeof PostCard>["post"])
      }
      toastService.success(POST_ACTIONS_CONFIG.editSuccess)
      onEdited?.(postId)
      return true
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.editError)
      return false
    }
  }, [post, onEdited])

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
        onEdit={handleEdit}
        onDeleted={(postId) => onRemoved?.(postId)}
        onArchivedChanged={(postId, archived) => {
          if (archived) onRemoved?.(postId)
        }}
      />
      <PostCommentsModal
        open={commentPostId !== null}
        postId={commentPostId}
        postTitle={(livePost as { title?: string }).title}
        viewer={viewerInfo}
        onClose={() => setCommentPostId(null)}
      />
      {showShareModal && (
        <ShareRouteModal
          isOpen={showShareModal}
          onClose={() => { setShowShareModal(false); setEditPost(null) }}
          editPost={editPost as never}
          onEditSubmit={handleEditSubmit}
        />
      )}
      {showRequestModal && (
        <RequestRouteModal
          isOpen={showRequestModal}
          onClose={() => { setShowRequestModal(false); setEditRequest(null) }}
          editRequest={editRequest as never}
          onEditSubmit={handleEditSubmit}
        />
      )}
    </>
  )
}
