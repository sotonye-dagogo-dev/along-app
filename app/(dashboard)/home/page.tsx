"use client"

import { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { RefreshCw, ClipboardList, History } from "lucide-react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { PostCard } from "@/app/components/features/posts"
import type { RespondToRequest, RouteRequestBody } from "@/app/components/features/posts"

const ShareRouteModal = dynamic(() => import("@/app/components/features/posts/ShareRouteModal"), { ssr: false })
const RequestRouteModal = dynamic(() => import("@/app/components/features/posts/RequestRouteModal"), { ssr: false })
import { AppEmptyState, PostCardSkeleton } from "@/app/components/ui"
import { SuggestionsPanel } from "@/app/components/ui/SuggestionsPanel"
import { SuggestionsRail } from "@/app/components/features/suggestions/SuggestionsRail"
import { EMPTY_STATES } from "@/app/lib/config"
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts"
import { routeDraftsService } from "@/app/lib/services/routeDraftsService"
import { useAuth } from "@/app/hooks/useAuth"
import { useTranslation } from "@/app/providers/I18nProvider"
import { useFeedInteractions } from "@/app/hooks/useFeedInteractions"
import { usePostShare } from "@/app/hooks/usePostShare"
import { feedStream } from "@/app/lib/streams/feedStream"

interface FeedPost {
  id: string
  title: string
  routes: unknown
  images: string[]
  tags: string[]
  likes: number
  dislikes: number
  comments: number
  bookmarks: number
  validityScore: number
  validityTier: string | null
  validityBreakdown?: {
    community?: number
    detail?: number
    corroboration?: number
    recency?: number
    reputation?: number
    engagement?: number
    score?: number
  } | null
  isPlatformGen?: boolean
  createdAt: string
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
    avatarConfig?: unknown
  }
  _isLiked?: boolean
  _isBookmarked?: boolean
  totalDistanceKm?: number | null
  estimatedMins?: number | null
  region?: string | null
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  waypoints?: { lat: number; lng: number }[] | null
}

/** Payload accepted by POST /api/posts (share + request + response flows). */
interface NewPostPayload {
  title: string
  description?: string
  type?: "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE"
  quotedPostId?: string
  routes: unknown[]
  images?: string[]
  tags?: string[]
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  waypoints?: { lat: number; lng: number }[]
  /** Idempotency key for this composer session — dedups double-clicks/retries. */
  clientMutationId?: string
}

// In-flight POST /api/posts dedup: a second submit carrying the same
// clientMutationId while the first is unresolved is ignored (the modal's
// disabled button is the first layer; this is the second).
const inflightPostKeys = new Set<string>()

function HomeContent() {
  const { tf } = useTranslation()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [respondTo, setRespondTo] = useState<RespondToRequest | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)
  const [draftsCount, setDraftsCount] = useState(0)
  const [openDraftsOnShare, setOpenDraftsOnShare] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)
  const { user, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("share") === "true") {
      setShowShareModal(true)
    }
  }, [searchParams])

  // Saved route drafts: badge count stays fresh via the drafts-changed event.
  useEffect(() => {
    const refresh = () => {
      try {
        setDraftsCount(routeDraftsService.countDrafts())
      } catch {
        /* never-throw: badge simply hides */
      }
    }
    refresh()
    window.addEventListener(ROUTE_DRAFTS_CONFIG.changedEvent, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(ROUTE_DRAFTS_CONFIG.changedEvent, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const openComposerForDrafts = useCallback(() => {
    setRespondTo(null)
    setOpenDraftsOnShare(true)
    setShowShareModal(true)
  }, [])

  // Stable modal identities: AppModal keys its Escape listener off onClose,
  // so inline arrow props churned the listener on every feed re-render and
  // (pre-focus-guard) cost input focus per keystroke on mobile keyboards.
  const closeShareModal = useCallback(() => {
    setShowShareModal(false)
    setRespondTo(null)
    setEditPost(null)
    setOpenDraftsOnShare(false)
  }, [])

  const closeRequestModal = useCallback(() => {
    setShowRequestModal(false)
  }, [])

  const openRequestFromShare = useCallback(() => {
    setShowShareModal(false)
    setRespondTo(null)
    setShowRequestModal(true)
  }, [])

  useEffect(() => {
    if (authLoading) return // wait for auth so the feed cache key is user-scoped
    let cancelled = false

    const init = async () => {
      const state = await feedStream.loadInitial(user?.id)
      if (cancelled) return
      setPosts(state.posts)
      setHasMore(state.hasMore)
      setLoading(false)
    }
    init()

    const sub = feedStream.feedState$.subscribe((state) => {
      if (cancelled) return
      setPosts(state.posts)
      setHasMore(state.hasMore)
      setLoading(state.loading)
    })

    return () => {
      cancelled = true
      sub.unsubscribe()
    }
  }, [authLoading, user?.id])

  useEffect(() => {
    const sub = feedStream.feedState$.subscribe((state) => {
      if (state.posts.length > 0 && posts.length > 0 && !state.loading) {
        const currentIds = new Set(posts.map((p) => p.id))
        const fresh = state.posts.filter((p) => !currentIds.has(p.id))
        if (fresh.length > 0) {
          setNewPostsCount(fresh.length)
        }
      }
    })
    return () => sub.unsubscribe()
  }, [posts])

  // --- Scroll-aware "new posts" prompt (F1) ---
  const [promptVisible, setPromptVisible] = useState(false)
  const pendingCountRef = useRef(0)
  const suppressUntilRef = useRef(0)

  const evaluatePrompt = useCallback(() => {
    const nearTop = window.scrollY < 80
    const depth =
      window.scrollY /
      Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const show =
      pendingCountRef.current > 0 &&
      (nearTop || depth >= 0.12) && // visible at top of feed, or once reading deep
      Date.now() >= suppressUntilRef.current // time-throttled re-appearance
    setPromptVisible((prev) => (prev === show ? prev : show))
  }, [])

  useEffect(() => {
    pendingCountRef.current = newPostsCount
    evaluatePrompt()
  }, [newPostsCount, evaluatePrompt])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        evaluatePrompt()
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [evaluatePrompt])

  // Re-evaluate when the suppression window expires so a pending count resurfaces.
  useEffect(() => {
    if (pendingCountRef.current <= 0 || suppressUntilRef.current <= Date.now()) return
    const timer = setTimeout(evaluatePrompt, suppressUntilRef.current - Date.now() + 100)
    return () => clearTimeout(timer)
  }, [newPostsCount, evaluatePrompt])

  const handlePromptClick = () => {
    suppressUntilRef.current = Date.now() + 45_000 // throttle re-prompts
    setPromptVisible(false)
    refreshFeed()
  }

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          feedStream.loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading])

  const refreshFeed = async () => {
    setNewPostsCount(0)
    await feedStream.refresh()
  }

  const { sharePost } = usePostShare()

  const { handleLike, handleDislike, handleBookmark, handleComment } = useFeedInteractions({
    onLike: async (postId, liked) => {
      feedStream.applyInteraction({ postId, type: "like", value: liked })
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: liked ? "LIKE" : "DISLIKE" }),
      })
    },
    onDislike: async (postId) => {
      feedStream.applyInteraction({ postId, type: "dislike", value: true })
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DISLIKE" }),
      })
    },
    onBookmark: async (postId, _bookmarked) => {
      feedStream.applyInteraction({ postId, type: "bookmark", value: !!_bookmarked })
      await fetch(`/api/posts/${postId}/bookmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    },
  })

  /** Shared POST /api/posts handler — returns false on failure so modals stay open. */
  const submitPost = async (data: NewPostPayload): Promise<boolean> => {
    const { clientMutationId, ...body } = data
    // Second layer of double-submit protection (first layer: disabled button
    // + guard in the modal). Same key in flight → ignore the duplicate.
    if (clientMutationId && inflightPostKeys.has(clientMutationId)) return false
    if (clientMutationId) inflightPostKeys.add(clientMutationId)
    try {
      const { POST_SUBMIT_CONFIG } = await import("@/app/lib/config/postSubmit")
      const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation")
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientMutationId ? { [POST_SUBMIT_CONFIG.idempotencyHeader]: clientMutationId } : {}),
        },
        body: JSON.stringify(body),
      })
      let payload: { error?: string; message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }; post?: unknown } = {}
      try {
        const text = await res.text()
        payload = text ? JSON.parse(text) : {}
      } catch {
        payload = { error: "Unexpected server response. Please try again." }
      }
      if (res.ok) {
        // Force bust cache then reload
        await refreshFeed()
        // Also reload directly as backup in case feed cache still stale (cold-start)
        setTimeout(() => { refreshFeed() }, 800)
        return true
      }
      const { toastService } = await import("@/app/lib/services/toastService")
      // Sanitized first-field message (config-driven) so "Validation failed"
      // never shows without context and never leaks raw JSON/PII.
      // The modal keeps input + draft and shows its own banner on false.
      const friendly = firstRouteServerMessage(
        payload.details,
        payload.message ?? payload.error ?? "Failed to post. Please try again."
      )
      console.error("[submitPost] failed", { status: res.status, error: payload.error, details: payload.details })
      toastService.error(friendly)
      return false
    } catch {
      const { toastService } = await import("@/app/lib/services/toastService")
      const { sanitizeRouteErrorMessage } = await import("@/app/lib/config/routeValidation")
      toastService.error(sanitizeRouteErrorMessage("Network error. Please check your connection and try again."))
      return false
    } finally {
      if (clientMutationId) inflightPostKeys.delete(clientMutationId)
    }
  }

  const handleRespond = (post: { id: string; title: string; tags?: string[]; user?: RespondToRequest["user"] }) => {
    setRespondTo({ id: post.id, title: post.title, tags: post.tags ?? [], user: post.user ?? undefined })
    setEditPost(null)
    setShowShareModal(true)
  }

  /** Owner picked Edit on a card — open the composer prefilled (PATCH on submit). */
  const handleEditPost = useCallback((post: FeedPost) => {
    setRespondTo(null)
    setEditPost(post)
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
        // Honest sanitized feedback (was silent false) — modal stays open.
        try {
          const payload = await res.json().catch(() => null) as { message?: string; error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } | null
          const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation")
          const { toastService } = await import("@/app/lib/services/toastService")
          const { POST_ACTIONS_CONFIG } = await import("@/app/lib/config/postActions")
          toastService.error(
            firstRouteServerMessage(payload?.details, payload?.message ?? payload?.error ?? POST_ACTIONS_CONFIG.editError)
          )
        } catch {
          const { toastService } = await import("@/app/lib/services/toastService")
          const { POST_ACTIONS_CONFIG } = await import("@/app/lib/config/postActions")
          toastService.error(POST_ACTIONS_CONFIG.editError)
        }
        return false
      }
      const payload = await res.json().catch(() => null)
      const updated = payload?.post
      if (updated) {
        feedStream.updatePost(postId, {
          title: updated.title,
          routes: updated.routes,
          images: updated.images,
          tags: updated.tags,
        })
      } else {
        await refreshFeed()
      }
      return true
    } catch {
      try {
        const { toastService } = await import("@/app/lib/services/toastService")
        const { POST_ACTIONS_CONFIG } = await import("@/app/lib/config/postActions")
        toastService.error(POST_ACTIONS_CONFIG.editError)
      } catch { /* toast is best-effort */ }
      return false
    }
  }, [])

  const initials = user
    ? `${(user.firstName as string)?.[0] ?? ""}${(user.lastName as string)?.[0] ?? ""}`.toUpperCase()
    : "?"

  return (
    <>
      <div className="flex justify-center gap-6 min-w-0">
        <div className="w-full min-w-0 max-w-[640px] px-4 py-4 flex flex-col gap-3">
        {promptVisible && (
          <button
            onClick={handlePromptClick}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold cursor-pointer radius-lg shadow-md border-none animate-[slideDown_300ms_ease-out]"
          >
            <RefreshCw size={16} />
            {newPostsCount} new {newPostsCount === 1 ? "post" : "posts"}
          </button>
        )}

        <div
          onClick={() => {
            setRespondTo(null)
            setShowShareModal(true)
          }}
          role="button"
          aria-label="Share a route"
          className="bg-bg-card border border-border radius-lg px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-shadow duration-base shadow-sm hover:shadow-md"
        >
          <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-sm text-text-muted px-3 py-2 radius-md bg-bg-elevated">
            How far? Where we wan go?
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowRequestModal(true)
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 radius-md border border-border bg-bg-elevated text-xs font-semibold text-text-secondary cursor-pointer font-sans hover:bg-primary-muted hover:text-primary hover:border-primary-muted transition-colors duration-fast shrink-0"
            aria-label="Request a route"
          >
            <ClipboardList size={14} />
            <span className="hidden sm:inline">Request</span>
          </button>
        </div>

        {draftsCount > 0 && (
          <button
            type="button"
            onClick={openComposerForDrafts}
            aria-label={`Open ${ROUTE_DRAFTS_CONFIG.draftsCountLabel(draftsCount)} to restore and complete`}
            className="inline-flex items-center gap-1.5 self-start h-8 px-3 radius-md border border-border bg-bg-card text-xs font-semibold text-text-secondary cursor-pointer font-sans hover:bg-primary-muted hover:text-primary hover:border-primary-muted transition-colors duration-fast"
          >
            <History size={14} />
            {ROUTE_DRAFTS_CONFIG.resumeChipLabel(draftsCount)}
          </button>
        )}

        {/* Suggestions carousel: own overflow container, above the feed but
            below the share/request trigger div — never inside the feed flow. */}
        <SuggestionsRail />

        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as never}
              onLike={handleLike}
              onDislike={handleDislike}
              onBookmark={handleBookmark}
              onShare={(postId) => void sharePost(postId, post.title)}
              onComment={handleComment}
              onRespond={handleRespond}
              onEdit={handleEditPost as never}
              onDeleted={(postId) => feedStream.removePost(postId)}
              onRestored={() => void refreshFeed()}
              onArchivedChanged={(postId, archived) => {
                if (archived) feedStream.removePost(postId)
                else void refreshFeed()
              }}
            />
          ))
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)
        ) : (
          <AppEmptyState
            {...EMPTY_STATES.feed}
            title={tf("empty.feed.title", EMPTY_STATES.feed.title)}
            description={tf("empty.feed.desc", EMPTY_STATES.feed.description ?? "")}
            actionLabel={tf("empty.feed.action", EMPTY_STATES.feed.actionLabel ?? "")}
          />
        )}

        <div ref={loaderRef} className="h-4" />

        {loading && posts.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-circle animate-spin" />
          </div>
        )}
        </div>

        <SuggestionsPanel />
      </div>

      <ShareRouteModal
        isOpen={showShareModal}
        onClose={closeShareModal}
        responseTo={respondTo}
        startWithDraftsOpen={openDraftsOnShare}
        onSubmit={async (data) => submitPost(data)}
        onRequestRoute={openRequestFromShare}
        editPost={editPost as never}
        onEditSubmit={handleEditSubmit}
      />

      <RequestRouteModal
        isOpen={showRequestModal}
        onClose={closeRequestModal}
        onSubmit={async (data: RouteRequestBody) => submitPost(data)}
      />
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="max-w-[640px] mx-auto px-4 py-4"><PostCardSkeleton /><PostCardSkeleton /><PostCardSkeleton /></div>}>
      <HomeContent />
    </Suspense>
  )
}
