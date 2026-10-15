"use client"

import { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { RefreshCw, ClipboardList, History } from "lucide-react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { PostCard } from "@/app/components/features/posts"
import { PostCommentsModal } from "@/app/components/features/comments"
import type { RespondToRequest, RouteRequestBody, EditRouteRequest } from "@/app/components/features/posts"

const ShareRouteModal = dynamic(() => import("@/app/components/features/posts/ShareRouteModal"), { ssr: false })
const RequestRouteModal = dynamic(() => import("@/app/components/features/posts/RequestRouteModal"), { ssr: false })
import { AppEmptyState, PostCardSkeleton } from "@/app/components/ui"
import { SuggestionsPanel } from "@/app/components/ui/SuggestionsPanel"
import { SuggestionsRail } from "@/app/components/features/suggestions/SuggestionsRail"
import { EMPTY_STATES } from "@/app/lib/config"
import { FEED_FIRST_LOAD_CONFIG, FEED_NEW_POSTS_PROMPT_CONFIG } from "@/app/lib/config/feedAlgorithm"
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts"
import { routeDraftsService } from "@/app/lib/services/routeDraftsService"
import { useAuth } from "@/app/hooks/useAuth"
import { useTranslation } from "@/app/providers/I18nProvider"
import { useFeedInteractions } from "@/app/hooks/useFeedInteractions"
import { usePostShare } from "@/app/hooks/usePostShare"
import { feedStream } from "@/app/lib/streams/feedStream"
import { useUserLocation } from "@/app/lib/hooks/useUserLocation"

interface FeedPost {
  id: string
  title: string
  description?: string | null
  type?: "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE" | string
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
  _isDisliked?: boolean
  _isBookmarked?: boolean
  quotedPostId?: string | null
  quotedPost?: {
    id: string
    title: string
    user?: { userName: string; firstName: string; lastName: string }
    tags?: string[]
  } | null
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
  // First-load readiness: the skeleton persists until the single geo-aware
  // initial fetch settles (see the init effect below). Without this gate the
  // page paints a stale/non-geo snapshot and then visibly reorganizes it
  // once (background revalidation) or twice (geo re-rank) while scrolling.
  const [isReady, setIsReady] = useState(false)
  const readyRef = useRef(false)
  // One-shot guard per viewer key: the init effect re-runs on the
  // null → fix geolocation transition, but the first fetch must happen once.
  const startedForRef = useRef<Set<string>>(new Set())
  const [hasMore, setHasMore] = useState(true)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [respondTo, setRespondTo] = useState<RespondToRequest | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)
  const [editRequest, setEditRequest] = useState<EditRouteRequest | null>(null)
  const [draftsCount, setDraftsCount] = useState(0)
  const [openDraftsOnShare, setOpenDraftsOnShare] = useState(false)
  // Feed comment modal (parity with profile tabs): the comment icon opens the
  // shared modal with a routing link to the full post, never a full-page nav.
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const { user, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  // Passive fix only (no prompt beyond what the hook already handles):
  // feeds the behind-the-scenes nearby boost via ?lat=&lng=. Denials stay
  // silent — ranking simply falls back to the non-geo order.
  const passiveFix = useUserLocation({ watch: false })

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
    setEditPost(null)
    setEditRequest(null)
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
    setEditRequest(null)
    setOpenDraftsOnShare(false)
  }, [])

  const closeRequestModal = useCallback(() => {
    setShowRequestModal(false)
    setEditRequest(null)
  }, [])

  const openRequestFromShare = useCallback(() => {
    setShowShareModal(false)
    setRespondTo(null)
    setEditPost(null)
    setEditRequest(null)
    setShowRequestModal(true)
  }, [])

  useEffect(() => {
    if (authLoading) return // wait for auth so the feed cache key is user-scoped
    let cancelled = false

    // Single geo-aware first load: the passive fix resolves asynchronously
    // after mount, so the fetch waits for it up to geoWaitMs. Only one
    // scored order ever paints — no non-geo list followed by a silent geo
    // re-rank (the old second loadInitial that reshuffled the feed twice).
    const viewerKey = user?.id ?? "anon"
    const runInitial = async (fix: { lat: number; lng: number } | null) => {
      try {
        const state = await feedStream.loadInitial(user?.id, fix)
        if (cancelled) return
        setPosts(state.posts)
        setHasMore(state.hasMore)
        setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      } finally {
        if (!cancelled) {
          readyRef.current = true
          setIsReady(true)
        }
      }
    }
    let geoTimer: ReturnType<typeof setTimeout> | null = null
    if (!passiveFix) {
      if (!startedForRef.current.has(viewerKey)) {
        geoTimer = setTimeout(() => {
          if (!cancelled && !startedForRef.current.has(viewerKey)) {
            startedForRef.current.add(viewerKey)
            void runInitial(null)
          }
        }, FEED_FIRST_LOAD_CONFIG.geoWaitMs)
      }
    } else if (!startedForRef.current.has(viewerKey)) {
      startedForRef.current.add(viewerKey)
      void runInitial(passiveFix)
    }

    const sub = feedStream.feedState$.subscribe((state) => {
      if (cancelled) return
      // Pre-ready hold: the stream re-emits during loadInitial (stale-cache
      // paint + background revalidation). Committing those would flash a
      // provisional order before the settled snapshot — init commits once.
      if (!readyRef.current) return
      // Dedup guard: the stream already dedups, but a re-emitted identical
      // array (poll with no new rows, interaction echo) must not churn
      // rendering. Skip state updates when the id sequence is unchanged.
      setPosts((prev) => {
        if (prev.length === state.posts.length && prev.every((p, i) => p.id === state.posts[i]?.id)) return prev
        return state.posts
      })
      setHasMore(state.hasMore)
      setLoading(state.loading)
    })

    return () => {
      cancelled = true
      if (geoTimer) clearTimeout(geoTimer)
      sub.unsubscribe()
    }
    // passiveFix in deps: null → fix transition triggers the single fetch.
    // startedForRef keeps it one-shot per viewer (no geo double-fetch).
  }, [authLoading, user?.id, passiveFix])

  // Fresh-post counter without re-subscribing on every render: postsRef
  // tracks the current list so the single stream subscription below never
  // churns (the old [posts]-dep effect re-subscribed per render — glitchy).
  const postsRef = useRef<FeedPost[]>([])
  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  useEffect(() => {
    const sub = feedStream.feedState$.subscribe((state) => {
      const rendered = postsRef.current
      if (state.posts.length > 0 && rendered.length > 0 && !state.loading) {
        const currentIds = new Set(rendered.map((p) => p.id))
        const fresh = state.posts.filter((p) => !currentIds.has(p.id))
        if (fresh.length > 0) {
          setNewPostsCount(fresh.length)
        }
      }
    })
    return () => sub.unsubscribe()
  }, [])

  // --- Scroll-aware "new posts" prompt (F1 + tightening) ---
  // Config-driven thresholds/timers (FEED_NEW_POSTS_PROMPT_CONFIG): visible
  // at top or when reading deep, throttled re-appearance, auto-dismissed
  // after autoDismissSec, and click scrolls to top + refreshes into the
  // rightful score order.
  const [promptVisible, setPromptVisible] = useState(false)
  const pendingCountRef = useRef(0)
  const suppressUntilRef = useRef(0)

  const evaluatePrompt = useCallback(() => {
    const nearTop = window.scrollY < FEED_NEW_POSTS_PROMPT_CONFIG.nearTopPx
    const depth =
      window.scrollY /
      Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const show =
      pendingCountRef.current > 0 &&
      (nearTop || depth >= FEED_NEW_POSTS_PROMPT_CONFIG.deepDepth) && // visible at top of feed, or once reading deep
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

  // Auto-dismiss a stale pill after the configured window so it never
  // lingers buggily; the count stays and resurfaces via evaluatePrompt.
  useEffect(() => {
    if (!promptVisible) return
    const timer = setTimeout(() => {
      suppressUntilRef.current = Date.now() + FEED_NEW_POSTS_PROMPT_CONFIG.throttleAfterClickSec * 1000
      setPromptVisible(false)
    }, FEED_NEW_POSTS_PROMPT_CONFIG.autoDismissSec * 1000)
    return () => clearTimeout(timer)
  }, [promptVisible, newPostsCount])

  const handlePromptClick = () => {
    suppressUntilRef.current = Date.now() + FEED_NEW_POSTS_PROMPT_CONFIG.throttleAfterClickSec * 1000 // throttle re-prompts
    setPromptVisible(false)
    setNewPostsCount(0)
    pendingCountRef.current = 0
    try {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      /* non-visual env */
    }
    void refreshFeed()
  }

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          feedStream.loadMore(passiveFix)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, passiveFix])

  const refreshFeed = async () => {
    setNewPostsCount(0)
    await feedStream.refresh()
  }

  const { sharePost } = usePostShare()

  // Modal-first comment flow: same shared modal as profile tabs (composer +
  // list + expand-post link). Replaces the old full-page post navigation so
  // scrolling position and feed state survive the interaction.
  const openFeedComments = useCallback((postId: string) => {
    setCommentPostId(postId)
  }, [])

  const handleFeedCommentPosted = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments ?? 0) + 1 } : p)))
  }, [])

  const commentPost = commentPostId ? posts.find((p) => p.id === commentPostId) ?? null : null
  const commentViewer = {
    userName: (user as { userName?: string } | null)?.userName ?? "guest",
    displayName:
      `${(user as { firstName?: string } | null)?.firstName ?? ""} ${(user as { lastName?: string } | null)?.lastName ?? ""}`.trim() || "You",
    avatar: (user as { avatar?: string } | null)?.avatar ?? null,
    avatarConfig: (user as { avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null } | null)?.avatarConfig ?? null,
  }

  const { handleLike, handleDislike, handleBookmark } = useFeedInteractions({
    onLike: async (postId, liked) => {
      feedStream.applyInteraction({ postId, type: "like", value: liked })
      // The vote API toggles on repeat of the same type: always send LIKE
      // here (an unlike is a second LIKE that removes it; a switch clears a
      // prior dislike). Sending DISLIKE on unlike would wrongly add one.
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "LIKE" }),
      })
    },
    onDislike: async (postId, disliked) => {
      // Honor the toggle: repeat DISLIKE removes it (same toggle semantics).
      feedStream.applyInteraction({ postId, type: "dislike", value: disliked })
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
        // Own post pins to the top instantly (optimistic first paint) and
        // stays there until the next server refetch re-orders it into its
        // rightful score position — no confusion about "where did it go".
        // Falls back to a single refresh when the payload carries no row.
        try {
          const created = (payload as { post?: FeedPost }).post
          if (created && typeof created.id === "string") {
            feedStream.prependPost(created)
            setNewPostsCount(0)
            pendingCountRef.current = 0
            setPromptVisible(false)
            try {
              window.scrollTo({ top: 0, behavior: "smooth" })
            } catch {
              /* non-visual env */
            }
            return true
          }
        } catch {
          /* fall through to refresh */
        }
        await refreshFeed()
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
    setEditRequest(null)
    setShowShareModal(true)
  }

  /** Owner picked Edit on a card — route to the matching composer so a
   *  ROUTE_REQUEST stays a request (request form) and never loads in the
   *  route form. Nature is additionally enforced server-side. */
  const handleEditPost = useCallback((post: FeedPost) => {
    setRespondTo(null)
    if ((post as { type?: string }).type === "ROUTE_REQUEST") {
      const steps = Array.isArray(post.routes)
        ? (post.routes as { location?: string; description?: string }[])
        : []
      setEditRequest({
        id: post.id,
        title: post.title,
        description: post.description ?? "",
        routes: steps,
        tags: post.tags ?? [],
      })
      setEditPost(null)
      setShowShareModal(false)
      setShowRequestModal(true)
      return
    }
    setEditRequest(null)
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
          description: updated.description,
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

  /** Request edit submit — same PATCH path, request-shaped payload (no type). */
  const handleEditRequestSubmit = useCallback(
    async (
      postId: string,
      data: { title: string; description: string; routes: { location: string }[]; tags: string[] },
    ): Promise<boolean> => handleEditSubmit(postId, data as unknown as Record<string, unknown>),
    [handleEditSubmit],
  )

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
            aria-live="polite"
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold cursor-pointer radius-lg shadow-md border-none animate-[slideDown_300ms_ease-out]"
          >
            <RefreshCw size={16} />
            {FEED_NEW_POSTS_PROMPT_CONFIG.label(newPostsCount)}
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
            className="inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-1.5 sm:h-8 sm:px-3 radius-md border border-border bg-bg-elevated text-xs font-semibold text-text-secondary cursor-pointer font-sans hover:bg-primary-muted hover:text-primary hover:border-primary-muted transition-colors duration-fast shrink-0"
            aria-label="Request a route"
            title="Request a route"
          >
            <ClipboardList size={14} className="shrink-0" aria-hidden />
            {/* Visible label inside the button (Sprint 59): below the icon
                on small screens, beside it on larger ones — tapping the text
                performs the action as part of the button. */}
            <span className="sm:hidden text-[10px] leading-tight font-semibold whitespace-nowrap" aria-hidden>
              Request a route
            </span>
            <span className="hidden sm:inline whitespace-nowrap" aria-hidden>
              Request
            </span>
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

        {/* First-load gate: the skeleton persists until the single settled
            snapshot is ready — never a stale list that reshuffles twice. */}
        {!isReady ? (
          Array.from({ length: FEED_FIRST_LOAD_CONFIG.skeletonCount }).map((_, i) => <PostCardSkeleton key={i} />)
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as never}
              onLike={handleLike}
              onDislike={handleDislike}
              onBookmark={handleBookmark}
              onShare={(postId) => void sharePost(postId, post.title)}
              onComment={openFeedComments}
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
        editRequest={editRequest}
        onEditSubmit={handleEditRequestSubmit}
      />

      <PostCommentsModal
        open={commentPostId !== null}
        postId={commentPostId}
        postTitle={commentPost?.title}
        viewer={commentViewer}
        onClose={() => setCommentPostId(null)}
        onCommentPosted={handleFeedCommentPosted}
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
