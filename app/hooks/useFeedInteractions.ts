"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { undoService } from "@/app/lib/services/undoService"
import { toastService } from "@/app/lib/services/toastService"

interface UseFeedInteractionsOptions {
  onLike?: (postId: string, liked: boolean) => Promise<void> | void
  onDislike?: (postId: string, disliked: boolean) => Promise<void> | void
  onBookmark?: (postId: string, bookmarked: boolean) => Promise<void> | void
}

export function useFeedInteractions(options: UseFeedInteractionsOptions = {}) {
  const router = useRouter()
  const handleLike = useCallback(async (postId: string, liked: boolean) => {
    if (liked) {
      toastService.success("Route liked!")
    }
    try {
      await options.onLike?.(postId, liked)
    } catch {
      toastService.error("Failed to like route")
    }
  }, [options])

  const handleDislike = useCallback(async (postId: string, disliked: boolean) => {
    try {
      await options.onDislike?.(postId, disliked)
    } catch {
      toastService.error("Failed to dislike route")
    }
  }, [options])

  const handleBookmark = useCallback(async (postId: string, bookmarked: boolean) => {
    const undoId = `bookmark:${postId}`
    
    if (bookmarked) {
      toastService.success("Route bookmarked!")
    } else {
      undoService.register({
        id: undoId,
        label: "Undo bookmark removal",
        onUndo: () => {
          options.onBookmark?.(postId, true)
          toastService.success("Bookmark restored!")
        },
      })
      toastService.undo({
        message: "Bookmark removed",
        undoLabel: "Undo",
        onUndo: () => undoService.execute(undoId),
      })
    }

    try {
      await options.onBookmark?.(postId, bookmarked)
    } catch {
      toastService.error("Failed to update bookmark")
    }
  }, [options])

  // Fallback only: surfaces that render PostCard without their own comment
  // modal (i.e. not home/profile/search) soft-navigate client-side instead of
  // the old full-page reload. Prefer PostCommentsModal.
  const handleComment = useCallback((postId: string) => {
    router.push(`/posts/${postId}`)
  }, [router])

  return {
    handleLike,
    handleDislike,
    handleBookmark,
    handleComment,
  }
}
