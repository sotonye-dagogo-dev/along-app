"use client"

import { useState, useMemo, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Heart, ThumbsDown, MessageCircle, Bookmark, Share2, BadgeDollarSign, Maximize2, MapPin, Navigation, ClipboardList, Reply, Archive } from "lucide-react"
import { AppCard, TrustBadge, VehicleChip, AppEmptyState, ImageLightbox } from "@/app/components/ui"
import { VEHICLE_REGISTRY, EMPTY_STATES, MODERATION_CONFIG, POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { showStepFare, showStepVehicle } from "@/app/lib/config/routeSteps"
import { CommentInput, CommentList } from "@/app/components/features/comments"
import { LiveNavigationModal } from "@/app/components/features/posts"
import ShareRouteModal, { type EditPost } from "@/app/components/features/posts/ShareRouteModal"
import { PostMenu, type PostMenuPost } from "@/app/components/features/moderation"
import { undoService } from "@/app/lib/services/undoService"
import { toastService } from "@/app/lib/services/toastService"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { useUserLocation } from "@/app/lib/hooks/useUserLocation"
import { useRouteTrace } from "@/app/lib/hooks/useRouteTrace"
import { buildRoutePinsFromPost } from "@/app/lib/config/routePins"
import type { VehicleType } from "@/app/lib/types"
import type { RoutePin } from "@/app/components/features/posts/RouteMap"

const RouteMap = dynamic(() => import("@/app/components/features/posts/RouteMap").then((m) => ({ default: m.RouteMap })), { ssr: false })

interface RouteStep {
  location?: string
  description?: string
  vehicle?: string
  fare?: number
}

interface PostResponse {
  id: string
  title: string
  type: string
  createdAt: string
  likes: number
  comments: number
  validityScore: number
  validityTier: string | null
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
  }
}

interface PostDetail {
  id: string
  title: string
  description?: string | null
  type?: "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE"
  quotedPostId?: string | null
  quotedPost?: {
    id: string
    title: string
    type?: string
    createdAt?: string | Date
    user?: { id: string; userName: string; firstName: string; lastName: string; avatar?: string | null }
  } | null
  routes: unknown
  images: string[]
  tags: string[]
  likes: number
  dislikes: number
  comments: number
  bookmarks: number
  validityScore: number
  validityTier: string | null
  region: string | null
  totalDistanceKm: number | null
  estimatedMins: number | null
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  waypoints?: { lat: number; lng: number }[] | null
  isArchived?: boolean
  responses?: PostResponse[]
  responsesCount?: number
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
}

interface Comment {
  id: string
  text: string
  createdAt: string
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
    avatarConfig?: unknown
  }
}

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser, requireAuth, isLoading: authLoading } = useAuth()
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [showNavigation, setShowNavigation] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number; heading: number | null } | null>(null)
  // Passive fix so the user dot is always on the map once granted (live
  // navigation's high-accuracy fix takes precedence while navigating).
  const passiveLocation = useUserLocation()
  const mapUserLocation = userLocation ?? passiveLocation
  const [editOpen, setEditOpen] = useState(false)

  const postId = params.id as string
  const ready = !authLoading && Boolean(postId)
  const viewerId = currentUser?.id ?? "guest"

  const { data: postData, loading: postLoading, mutate: mutatePost } = useCachedFetch<{ post: PostDetail; archived?: boolean }>(
    ready ? `post:${viewerId}:${postId}` : null,
    `/api/posts/${postId}`,
    { ttlSec: 60, enabled: ready }
  )
  const { data: commentData, loading: commentsLoading, mutate: mutateComments } = useCachedFetch<{ comments: Comment[] }>(
    ready ? `post-comments:${viewerId}:${postId}` : null,
    `/api/posts/${postId}/comments`,
    { ttlSec: 60, enabled: ready }
  )

  const post = postData?.post ?? null
  const comments = commentData?.comments ?? []
  const liked = post?._isLiked ?? false
  const likesCount = post?.likes ?? 0
  const bookmarked = post?._isBookmarked ?? false
  const loading = authLoading || postLoading || commentsLoading

  const handleLike = async () => {
    if (!post) return
    const newLiked = !liked
    const prevLiked = post._isLiked ?? false
    const prevLikes = post.likes
    mutatePost({ post: { ...post, _isLiked: newLiked, likes: post.likes + (newLiked ? 1 : -1) } })
    // Like/dislike is intentionally undo-toast-free: a lightweight success
    // note on like, silence on unlike (the heart toggle is its own affordance).
    if (newLiked) {
      toastService.success("Route liked!")
    }
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "LIKE" }),
      })
    } catch {
      mutatePost({ post: { ...post, _isLiked: prevLiked, likes: prevLikes } })
    }
  }

  const handleBookmark = async () => {
    if (!post) return
    const newBookmarked = !bookmarked
    const prevBookmarked = post._isBookmarked ?? false
    mutatePost({ post: { ...post, _isBookmarked: newBookmarked } })
    const undoId = `bookmark:${postId}`
    if (!newBookmarked) {
      undoService.register({
        id: undoId,
        label: "Undo bookmark removal",
        onUndo: () => {
          mutatePost((prev) =>
            prev ? { post: { ...prev.post, _isBookmarked: true } } : { post: { ...post, _isBookmarked: true } }
          )
          fetch(`/api/posts/${postId}/bookmark`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => {})
          toastService.success("Bookmark restored!")
        },
      })
      toastService.undo({ message: "Bookmark removed", undoLabel: "Undo", onUndo: () => undoService.execute(undoId) })
    } else {
      toastService.success("Route bookmarked!")
    }
    try {
      await fetch(`/api/posts/${postId}/bookmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    } catch {
      mutatePost({ post: { ...post, _isBookmarked: prevBookmarked } })
    }
  }

  const handleComment = async (text: string) => {
    if (!requireAuth("comment on routes")) return
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const data = await res.json()
        mutateComments((prev) => ({ comments: [data.comment, ...(prev?.comments ?? [])] }))
      }
    } catch {
      console.error("Failed to post comment")
    }
  }

  const handleDeleteComment = (commentId: string) => {
    mutateComments((prev) => ({ comments: (prev?.comments ?? []).filter((c) => c.id !== commentId) }))
    if (postData) {
      mutatePost({ ...postData, post: { ...postData.post, comments: Math.max(0, postData.post.comments - 1) } })
    }
  }

  const handleUpdateComment = (comment: { id: string; text: string }) => {
    mutateComments((prev) => ({
      comments: (prev?.comments ?? []).map((c) => (c.id === comment.id ? { ...c, text: comment.text } : c)),
    }))
  }

  const refreshComments = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`)
      if (res.ok) {
        const data = await res.json()
        mutateComments({ comments: data.comments ?? [] })
      }
    } catch { /* keep cached list */ }
  }

  const refreshPost = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`)
      if (res.ok) {
        const data = await res.json()
        mutatePost(data)
      }
    } catch { /* keep cached post */ }
  }

  const handleEditSubmit = async (editId: string, data: Omit<EditPost, "id">): Promise<boolean> => {
    try {
      const res = await fetch(`/api/posts/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("edit failed")
      setEditOpen(false)
      await refreshPost()
      return true
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.editError)
      return false
    }
  }

  const routes = useMemo(() =>
    post && Array.isArray(post.routes) ? (post.routes as RouteStep[]) : [],
    [post]
  )
  const trustLevel = (post?.validityTier as "low" | "developing" | "verified" | "trusted") ?? "developing"
  const initials = post ? `${post.user.firstName[0]}${post.user.lastName[0]}`.toUpperCase() : ""

  const baseRoutePins: RoutePin[] = useMemo(() => {
    // Canonical builder: origin + intermediate waypoints + destination in
    // step order — identical sequencing to the share-preview, so the post
    // view traces start → stop(s) → destination instead of skipping stops.
    if (!post) return []
    return buildRoutePinsFromPost({
      routes: post.routes,
      startLat: post.startLat,
      startLng: post.startLng,
      endLat: post.endLat,
      endLng: post.endLng,
      waypoints: post.waypoints,
    }) as RoutePin[]
  }, [post])
  // Legacy backfill: rows stored before waypoints were persisted carry only
  // start/end coords even though `routes` lists intermediate stops. Geocode
  // the missing stop labels (bounded, best-effort, cached by the geocode
  // proxy) so those posts render every stop instead of skipping to the
  // destination. New posts already carry waypoints, so this stays idle.
  const [backfilledPins, setBackfilledPins] = useState<RoutePin[] | null>(null)
  useEffect(() => {
    let cancelled = false
    setBackfilledPins(null)
    if (!post || baseRoutePins.length !== 2 || routes.length <= 2) return
    const missing = routes.slice(1, -1).filter((s) => s.location?.trim())
    if (missing.length === 0 || missing.length > 5) return
    ;(async () => {
      try {
        const results: { lat: number; lng: number }[] = []
        for (const step of missing) {
          try {
            const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(step.location!)}&limit=1`)
            if (!res.ok) return // abort backfill — keep start/end rather than partial
            const data = (await res.json()) as { results?: { lat: string; lon: string }[] }
            const first = Array.isArray(data.results) ? data.results[0] : undefined
            if (!first) return
            const lat = parseFloat(first.lat)
            const lng = parseFloat(first.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return
            results.push({ lat, lng })
          } catch {
            return
          }
        }
        if (cancelled || results.length !== missing.length) return
        const origin = baseRoutePins[0]
        const dest = baseRoutePins[baseRoutePins.length - 1]
        setBackfilledPins([
          origin,
          ...results.map((c, i) => ({
            lat: c.lat,
            lng: c.lng,
            label: missing[i].location ?? "",
            type: "waypoint" as const,
          })),
          dest,
        ])
      } catch {
        // silent — start/end remain on screen
      }
    })()
    return () => {
      cancelled = true
    }
  }, [post, baseRoutePins, routes])
  const routePins = backfilledPins ?? baseRoutePins
  // Road-snapped trace for the full stop sequence (same pipeline as the
  // composer preview). Silent straight-line fallback when offline/tracing
  // fails — RouteMap draws through all pins either way.
  const { liveTrace } = useRouteTrace(routePins)

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 bg-bg-elevated radius-md w-3/4" />
          <div className="h-4 bg-bg-elevated radius-md w-1/4" />
          <div className="h-64 bg-bg-elevated radius-md" />
          <div className="h-4 bg-bg-elevated radius-md w-full" />
          <div className="h-4 bg-bg-elevated radius-md w-2/3" />
        </div>
      </div>
    )
  }

  if (!post || !commentData) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <AppEmptyState {...EMPTY_STATES.error} />
      </div>
    )
  }

  // Archived posts: direct links don't 404 — other viewers get a tombstone.
  if (postData?.archived) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-circle bg-bg-elevated flex items-center justify-center text-text-muted">
          <Archive size={22} />
        </div>
        <h1 className="text-xl font-bold text-text-primary">This post is archived</h1>
        <p className="text-sm text-text-secondary">The author hid it from feeds. The link still works for them.</p>
        <Link href="/home" className="text-sm font-semibold text-primary no-underline hover:underline">Back to home</Link>
      </div>
    )
  }

  // Route requests are not routes: no map, no navigation guide, no trust
  // score, no fare/amount (metadata-driven via MODERATION_CONFIG.routeRequestHides).
  const isRouteRequest = post.type === "ROUTE_REQUEST"
  const showMap = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.map) && routePins.length > 0
  const showNav = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.navigationGuide)
  const showTrust = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.trustScore)
  const showFare = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.fare)
  const isArchived = post.isArchived ?? false
  const responses = post.responses ?? []
  const viewerRole = (currentUser as { role?: string } | null)?.role ?? null
  const editPost: EditPost | null = editOpen
    ? {
        id: post.id,
        title: post.title,
        ...(post.description ? { description: post.description } : {}),
        routes: routes.map((s) => ({
          ...(s.location ? { location: s.location } : {}),
          ...(s.description ? { description: s.description } : {}),
          ...(s.vehicle ? { vehicle: s.vehicle } : {}),
          ...(typeof s.fare === "number" ? { fare: s.fare } : {}),
        })),
        tags: post.tags,
        images: post.images,
      }
    : null

  return (
    <div className="max-w-[680px] mx-auto px-4 py-4">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
        <Link href="/home" className="w-9 h-9 rounded-circle bg-bg-elevated flex items-center justify-center text-text-secondary hover:bg-primary-muted hover:text-primary transition-colors duration-fast no-underline">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-1 text-sm text-text-secondary flex-1">
          <Link href="/home" className="text-text-secondary no-underline hover:text-primary hover:underline">Home</Link>
          <span className="text-text-muted">/</span>
          <Link href="/explore" className="text-text-secondary no-underline hover:text-primary hover:underline">Routes</Link>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => {}} className="w-9 h-9 rounded-circle flex items-center justify-center border-none bg-transparent text-text-secondary cursor-pointer hover:bg-bg-elevated hover:text-primary transition-colors duration-fast" aria-label="Share">
            <Share2 size={18} />
          </button>
          <button onClick={handleBookmark} className={`w-9 h-9 rounded-circle flex items-center justify-center border-none bg-transparent cursor-pointer transition-colors duration-fast hover:bg-bg-elevated hover:text-primary ${bookmarked ? "text-primary" : "text-text-secondary"}`} aria-label="Bookmark">
            <Bookmark size={18} className={bookmarked ? "fill-primary stroke-primary" : ""} />
          </button>
          <PostMenu
            post={post as unknown as PostMenuPost}
            title={post.title}
            viewerId={currentUser?.id ?? null}
            viewerRole={viewerRole}
            requireAuth={(action) => requireAuth(action)}
            onEdit={() => setEditOpen(true)}
            onDeleted={() => router.push("/home")}
            onRestored={() => void refreshPost()}
            onArchivedChanged={() => void refreshPost()}
          />
        </div>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-3">{post.title}</h1>

      {isArchived && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[11px] font-semibold bg-bg-elevated text-text-secondary border border-border">
            <Archive size={11} />
            Archived — only you can see this
          </span>
        </div>
      )}

      {isRouteRequest && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[11px] font-semibold bg-warning text-warning-text border border-warning-border">
            <ClipboardList size={11} />
            Route request
          </span>
        </div>
      )}

      {post.type === "ROUTE_RESPONSE" && post.quotedPost && (
        <div className="mb-3">
          <Link
            href={`/posts/${post.quotedPost.id}`}
            className="flex items-start gap-2 px-3 py-2 bg-bg-elevated border border-border radius-md no-underline hover:border-primary/40 transition-colors duration-fast"
          >
            <Reply size={13} className="text-primary mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] text-text-muted">
                Responding to
                {post.quotedPost.user
                  ? ` ${post.quotedPost.user.firstName} ${post.quotedPost.user.lastName}`
                  : ""}&apos;s request
              </span>
              <span className="block text-xs font-medium text-text-primary truncate">{post.quotedPost.title}</span>
            </span>
          </Link>
        </div>
      )}

      {post.description && (
        <p className="text-[15px] text-text-primary leading-relaxed mb-3.5">{post.description}</p>
      )}

      <div className="flex items-center gap-2.5 mb-3">
        <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary shrink-0 no-underline">
          {initials}
        </Link>
        <div>
          <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-text-primary no-underline hover:underline">
            {post.user.firstName} {post.user.lastName}
          </Link>
          <div className="text-sm text-text-secondary">
            <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-text-secondary no-underline hover:underline">@{post.user.userName}</Link> · {getTimeAgo(post.createdAt)}
          </div>
        </div>
        <span className="text-xs text-text-muted ml-auto">
          {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="mb-3.5">
        {showTrust && <TrustBadge level={trustLevel} score={post.validityScore} />}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {post.tags.map((tag) => (
          <Link key={tag} href={`/explore?tag=${encodeURIComponent(tag)}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-2.5 py-0.5 radius-pill text-xs font-medium bg-bg-elevated border border-border text-text-secondary no-underline hover:bg-primary-muted hover:text-primary hover:border-primary-muted transition-colors duration-fast">
            #{tag}
          </Link>
        ))}
        {post.region && (
          <Link href={`/explore?region=${encodeURIComponent(post.region)}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-2.5 py-0.5 radius-pill text-xs font-medium bg-primary-muted text-primary border border-primary-muted no-underline">
            <MapPin size={12} />
            {post.region}
          </Link>
        )}
      </div>

      {showMap && (
      <div className="w-full h-[280px] radius-md overflow-hidden mb-4">
        <RouteMap
          pins={routePins}
          encodedPolyline={liveTrace?.polyline}
          height={280}
          showOverlay={true}
          distance={post.totalDistanceKm ?? undefined}
          duration={post.estimatedMins ?? undefined}
          userLocation={mapUserLocation}
          followUser={false}
        />
      </div>
      )}

      <div className="flex flex-col gap-3 mb-5">
        {routes.map((step, index) => (
          <div key={index} className="flex items-start gap-3 relative">
            {index < routes.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-12px] w-0.5 bg-border" />
            )}
            <div className="w-6 h-6 rounded-circle bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </div>
            <div className="flex-1">
              {step.location && (
                <div className="text-sm font-medium text-text-primary">{step.location}</div>
              )}
              {step.description && (
                <div className="text-sm text-text-secondary mt-0.5 mb-1.5">{step.description}</div>
              )}
              {!step.location && !step.description && (
                <div className="text-sm text-text-muted italic mb-1.5">Stop {index + 1}</div>
              )}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Destination is the final stop — no fare/vehicle there
                    (also stripped server-side; this hides legacy rows too). */}
                {showFare && showStepFare(index, routes.length) && step.fare !== undefined && step.fare !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-bg-elevated text-text-secondary">
                    <BadgeDollarSign size={12} />₦{step.fare}
                  </span>
                )}
                {showStepVehicle(index, routes.length) && step.vehicle && VEHICLE_REGISTRY[step.vehicle as VehicleType] && (
                  <VehicleChip type={step.vehicle as VehicleType} size="sm" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {post.images.length > 0 && (
        <div className="grid grid-cols-2 gap-1 radius-md overflow-hidden mb-5" style={post.images.length >= 3 ? { gridTemplateRows: "auto auto" } : {}}>
          {post.images.slice(0, 3).map((img, i) => (
            <div key={i} className={`relative cursor-pointer overflow-hidden group ${i === 0 && post.images.length >= 3 ? "row-span-2" : ""}`} onClick={() => setExpandedImage(img)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`Route photo ${i + 1}`} width={post.images.length === 1 ? 400 : 200} height={post.images.length === 1 ? 280 : i === 0 && post.images.length >= 3 ? 220 : 110} className={`w-full object-cover ${i === 0 && post.images.length >= 3 ? "h-full min-h-[220px]" : post.images.length === 1 ? "h-[280px]" : "h-[110px]"}`} loading="lazy" />
              <div className="absolute inset-0 bg-black/4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                <Maximize2 size={28} className="text-white bg-black/30 rounded-circle p-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      {expandedImage && (
        <ImageLightbox
          images={post.images}
          initialIndex={post.images.indexOf(expandedImage)}
          onClose={() => setExpandedImage(null)}
        />
      )}

      <div className="flex items-center gap-1 py-3 border-t border-border border-b mb-5">
        <button onClick={handleLike} className={`flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-sm font-medium cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-elevated ${liked ? "liked text-error-text" : "text-text-secondary"}`} aria-label="Like">
          <Heart size={16} className={liked ? "fill-error-text stroke-error-text" : ""} />
          {likesCount > 0 && <span>{formatCount(likesCount)}</span>}
        </button>
        <button className="flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-sm font-medium text-text-secondary cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-elevated" aria-label="Dislike">
          <ThumbsDown size={16} />
          {post.dislikes > 0 && <span>{formatCount(post.dislikes)}</span>}
        </button>
        <button className="flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-sm font-medium text-text-secondary cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-elevated" aria-label="Comment">
          <MessageCircle size={16} />
          {post.comments > 0 && <span>{formatCount(post.comments)}</span>}
        </button>
        <div className="flex-1" />
        <button onClick={handleBookmark} className={`flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-sm font-medium cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-elevated ${bookmarked ? "text-primary" : "text-text-secondary"}`} aria-label="Bookmark">
          <Bookmark size={16} className={bookmarked ? "fill-primary stroke-primary" : ""} />
        </button>
        <button className="flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-sm font-medium text-text-secondary cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-elevated" aria-label="Share">
          <Share2 size={16} />
        </button>
      </div>

      {showNav && (
        <AppCard variant="elevated" className="p-5 mb-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <div className="w-10 h-10 rounded-circle bg-primary-muted flex items-center justify-center">
                <Navigation size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Navigation Guide</h3>
                <p className="text-xs text-text-secondary">Step-by-step turn-by-turn directions for this route</p>
              </div>
            </div>
            <button
              onClick={() => setShowNavigation(true)}
              className="h-10 px-5 radius-md bg-primary text-white border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-colors duration-fast flex items-center gap-2"
            >
              <Navigation size={16} />
              Start Navigation
            </button>
          </div>
        </AppCard>
      )}

      {/* Floating live-navigation overlay: map + guide hand-in-hand. */}
      {showNav && (
        <LiveNavigationModal
          open={showNavigation}
          title={post.title}
          steps={routes}
          pins={routePins}
          encodedPolyline={liveTrace?.polyline}
          totalDistanceKm={post.totalDistanceKm}
          estimatedMins={post.estimatedMins}
          userLocation={userLocation}
          onUserLocationChange={setUserLocation}
          onClose={() => { setShowNavigation(false); setUserLocation(null) }}
        />
      )}

      {isRouteRequest && (
        <div className="mb-6">
          <h3 className="text-base font-semibold mb-3">
            Responses <span className="font-normal text-sm text-text-muted">· {responses.length}</span>
          </h3>
          {responses.length === 0 ? (
            <p className="text-sm text-text-secondary bg-bg-elevated border border-border radius-md px-4 py-3">
              No responses yet — be the first to share this route.
            </p>
          ) : (
            <div className="flex flex-col">
              {responses.map((r) => (
                <Link
                  key={r.id}
                  href={`/posts/${r.id}`}
                  className="flex gap-2.5 py-3 border-b border-border last:border-b-0 no-underline"
                >
                  <span className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {(r.user.firstName[0] ?? "")}{(r.user.lastName[0] ?? "")}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">
                      {r.user.firstName} {r.user.lastName}
                      <span className="ml-1.5 font-normal text-xs text-text-muted">{getTimeAgo(r.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-primary font-medium">
                      <Reply size={13} className="shrink-0" />
                      <span className="truncate">{r.title}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {r.likes > 0 && `${r.likes} like${r.likes === 1 ? "" : "s"} · `}
                      {r.comments > 0 && `${r.comments} comment${r.comments === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-base font-semibold mb-3">
          Comments <span className="font-normal text-sm text-text-muted">· {comments.length}</span>
        </h3>
        <CommentInput
          userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User"}
          onSubmit={handleComment}
        />
        <CommentList
          comments={comments}
          postId={postId}
          onDeleted={handleDeleteComment}
          onUpdated={handleUpdateComment}
          onRestored={() => void refreshComments()}
        />
      </div>

      {editOpen && (
        <ShareRouteModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          editPost={editPost}
          onEditSubmit={handleEditSubmit}
        />
      )}
    </div>
  )
}
