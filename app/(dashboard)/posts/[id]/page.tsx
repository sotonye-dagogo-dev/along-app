"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Heart, ThumbsDown, MessageCircle, Bookmark, Share2, BadgeDollarSign, Maximize2, MapPin, Navigation } from "lucide-react"
import { AppCard, TrustBadge, VehicleChip, AppEmptyState, ImageLightbox } from "@/app/components/ui"
import { VEHICLE_REGISTRY, EMPTY_STATES } from "@/app/lib/config"
import { CommentInput, CommentList } from "@/app/components/features/comments"
import { NavigationGuide } from "@/app/components/features/posts"
import { undoService } from "@/app/lib/services/undoService"
import { toastService } from "@/app/lib/services/toastService"
import { useAuth } from "@/app/hooks/useAuth"
import type { VehicleType } from "@/app/lib/types"
import type { RoutePin } from "@/app/components/features/posts/RouteMap"

const RouteMap = dynamic(() => import("@/app/components/features/posts/RouteMap").then((m) => ({ default: m.RouteMap })), { ssr: false })

interface RouteStep {
  location?: string
  description?: string
  vehicle?: string
  fare?: number
}

interface PostDetail {
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
  region: string | null
  totalDistanceKm: number | null
  estimatedMins: number | null
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
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
  const { user: currentUser, requireAuth } = useAuth()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [showNavigation, setShowNavigation] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number; heading: number | null } | null>(null)

  const postId = params.id as string

  useEffect(() => {
    if (!postId) return
    const abort = new AbortController()
    const load = async () => {
      try {
        const [postRes, commentRes] = await Promise.all([
          fetch(`/api/posts/${postId}`, { signal: abort.signal }),
          fetch(`/api/posts/${postId}/comments`, { signal: abort.signal }),
        ])
        if (!postRes.ok || !commentRes.ok) throw new Error("Failed to load post")
        const postData = await postRes.json()
        const commentData = await commentRes.json()
        if (abort.signal.aborted) return
        setPost(postData.post)
        setComments(commentData.comments)
        setLiked(postData.post._isLiked ?? false)
        setLikesCount(postData.post.likes)
        setBookmarked(postData.post._isBookmarked ?? false)
      } catch (err: unknown) {
        if (abort.signal.aborted) return
        console.error("Failed to load post")
      } finally {
        if (!abort.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => abort.abort()
  }, [postId])

  const handleLike = async () => {
    const newLiked = !liked
    const prevLiked = liked
    setLiked(newLiked)
    setLikesCount((prev) => prev + (newLiked ? 1 : -1))
    const undoId = `like:${postId}`
    if (!newLiked) {
      undoService.register({
        id: undoId,
        label: "Undo unlike",
        onUndo: () => {
          setLiked(true)
          setLikesCount((p) => p + 1)
          fetch(`/api/posts/${postId}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "LIKE" }) }).catch(() => {})
          toastService.success("Like restored!")
        },
      })
      toastService.undo({ message: "Route unliked", undoLabel: "Undo", onUndo: () => undoService.execute(undoId) })
    } else {
      toastService.success("Route liked!")
    }
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "LIKE" }),
      })
    } catch {
      setLiked(prevLiked)
      setLikesCount((prev) => prev + (prevLiked ? 1 : -1))
    }
  }

  const handleBookmark = async () => {
    const newBookmarked = !bookmarked
    const prevBookmarked = bookmarked
    setBookmarked(newBookmarked)
    const undoId = `bookmark:${postId}`
    if (!newBookmarked) {
      undoService.register({
        id: undoId,
        label: "Undo bookmark removal",
        onUndo: () => {
          setBookmarked(true)
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
      setBookmarked(prevBookmarked)
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
        setComments((prev) => [data.comment, ...prev])
      }
    } catch {
      console.error("Failed to post comment")
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" })
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      console.error("Failed to delete comment")
    }
  }

  const routes = useMemo(() =>
    post && Array.isArray(post.routes) ? (post.routes as RouteStep[]) : [],
    [post]
  )
  const trustLevel = (post?.validityTier as "low" | "developing" | "verified" | "trusted") ?? "developing"
  const initials = post ? `${post.user.firstName[0]}${post.user.lastName[0]}`.toUpperCase() : ""

  const routePins: RoutePin[] = useMemo(() => {
    // Use actual waypoints if stored, otherwise fall back to start/end
    if (post && Array.isArray((post as unknown as { waypoints?: unknown }).waypoints) && ((post as unknown as { waypoints: unknown[] }).waypoints.length > 0)) {
      const wps = (post as unknown as { waypoints: { lat: number; lng: number }[] }).waypoints
      return wps.map((w, i) => ({
        lat: w.lat,
        lng: w.lng,
        label: routes[i]?.location ?? `Stop ${i + 1}`,
        type: i === 0 ? "origin" as const : i === wps.length - 1 ? "destination" as const : "waypoint" as const,
      })).filter((p) => p.lat !== 0 || p.lng !== 0)
    }
    if (post?.startLat && post?.startLng) {
      const pins: RoutePin[] = [
        { lat: post.startLat, lng: post.startLng, label: routes[0]?.location ?? "Start", type: "origin" as const },
      ]
      if (post.endLat && post.endLng && routes.length > 1) {
        pins.push({ lat: post.endLat, lng: post.endLng, label: routes[routes.length - 1]?.location ?? "End", type: "destination" as const })
      }
      // If we have more than 2 steps but only start/end coords, interpolate intermediate for navigation
      if (routes.length > 2 && pins.length === 2) {
        // Keep only start/end; navigation will still step through descriptions
      }
      return pins.filter((p) => !(p.lat === 0 && p.lng === 0))
    }
    // No coords: return empty to avoid 0,0 markers in ocean
    return []
  }, [routes, post?.startLat, post?.startLng, post?.endLat, post?.endLng])

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

  if (!post) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <AppEmptyState {...EMPTY_STATES.error} />
      </div>
    )
  }

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
        </div>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-3">{post.title}</h1>

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
        <TrustBadge level={trustLevel} score={post.validityScore} />
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

      <div className="w-full h-[280px] radius-md overflow-hidden mb-4">
        <RouteMap
          pins={routePins}
          height={280}
          showOverlay={true}
          distance={post.totalDistanceKm ?? undefined}
          duration={post.estimatedMins ?? undefined}
          userLocation={userLocation}
          followUser={showNavigation && !!userLocation}
        />
      </div>

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
                {step.fare !== undefined && step.fare !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-bg-elevated text-text-secondary">
                    <BadgeDollarSign size={12} />₦{step.fare}
                  </span>
                )}
                {step.vehicle && VEHICLE_REGISTRY[step.vehicle as VehicleType] && (
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

      {showNavigation ? (
        <div className="mb-5">
          <NavigationGuide
            steps={routes}
            totalDistanceKm={post.totalDistanceKm}
            estimatedMins={post.estimatedMins}
            pins={routePins.map((p) => ({ lat: p.lat, lng: p.lng }))}
            onUserLocationChange={setUserLocation}
            onClose={() => { setShowNavigation(false); setUserLocation(null) }}
          />
        </div>
      ) : (
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

      <div className="mb-6">
        <h3 className="text-base font-semibold mb-3">
          Comments <span className="font-normal text-sm text-text-muted">· {comments.length}</span>
        </h3>
        <CommentInput
          userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User"}
          onSubmit={handleComment}
        />
        <CommentList comments={comments} onDelete={handleDeleteComment} />
      </div>
    </div>
  )
}
