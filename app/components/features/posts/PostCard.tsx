"use client"

import { useState, useReducer, useContext, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Heart, ThumbsDown, MessageCircle, Bookmark, Share2, BadgeDollarSign, ClipboardList, Reply, Archive, MessagesSquare } from "lucide-react"
import { AppCard, AppUserLabel, TrustBadge, VehicleChip, ImageLightbox } from "@/app/components/ui"
import { PostMenu, type PostMenuPost } from "@/app/components/features/moderation"
import { AuthContext } from "@/app/providers/AuthProvider"
import { MODERATION_CONFIG } from "@/app/lib/config"
import { showStepFare, showStepVehicle } from "@/app/lib/config/routeSteps"
import type { VehicleType } from "@/app/lib/types"

const MiniRouteMap = dynamic(() => import("./RouteMap").then((m) => ({ default: m.RouteMap })), { ssr: false })

interface RouteStep {
  location?: string
  description?: string
  vehicle?: string
  fare?: number
}

interface PostCardUser {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar?: string | null
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string }
}

interface PostCardPost {
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
  routes: RouteStep[] | unknown
  images: string[]
  tags: string[]
  likes: number
  dislikes: number
  comments: number
  bookmarks: number
  validityScore: number
  validityTier: string | null
  isPlatformGen?: boolean
  isArchived?: boolean
  responsesCount?: number
  createdAt: string | Date
  user: PostCardUser
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

interface PostCardProps {
  post: PostCardPost
  onLike?: (postId: string, liked: boolean) => void
  onDislike?: (postId: string, disliked: boolean) => void
  onBookmark?: (postId: string, bookmarked: boolean) => void
  onShare?: (postId: string) => void
  onComment?: (postId: string) => void
  /** Called when the Respond CTA on a ROUTE_REQUEST card is clicked (auth-gated). */
  onRespond?: (post: PostCardPost) => void
  /** Called when the owner picks Edit (parent opens the composer in edit mode). */
  onEdit?: (post: PostCardPost) => void
  /** Called after a confirmed delete succeeds (parent removes the card). */
  onDeleted?: (postId: string) => void
  /** Called after an undo-restore recreates the post (parent refreshes). */
  onRestored?: (oldId: string, newId: string) => void
  /** Called after archive/unarchive succeeds (parent updates or removes). */
  onArchivedChanged?: (postId: string, archived: boolean) => void
}

function getTimeAgo(date: string | Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function extractVehicles(routes: unknown): string[] {
  if (!Array.isArray(routes)) return []
  const vehicles = new Set<string>()
  // Destination is the final stop — its vehicle (if a legacy row carries
  // one) never describes an onward leg, so it is excluded here.
  for (let i = 0; i < routes.length; i++) {
    const step = routes[i]
    if (!showStepVehicle(i, routes.length)) continue
    if (step && typeof step === "object" && "vehicle" in step && step.vehicle) {
      vehicles.add(step.vehicle as string)
    }
  }
  return Array.from(vehicles)
}

interface PostCardState {
  liked: boolean
  likesCount: number
  disliked: boolean
  dislikesCount: number
  bookmarked: boolean
}

type PostCardAction =
  | { type: "TOGGLE_LIKE" }
  | { type: "TOGGLE_DISLIKE" }
  | { type: "TOGGLE_BOOKMARK" }
  | { type: "SET_FROM_PROPS"; payload: PostCardPost }

function postCardReducer(state: PostCardState, action: PostCardAction): PostCardState {
  switch (action.type) {
    case "TOGGLE_LIKE": {
      const newLiked = !state.liked
      return {
        ...state,
        liked: newLiked,
        likesCount: state.likesCount + (newLiked ? 1 : -1),
        disliked: newLiked ? false : state.disliked,
        dislikesCount: newLiked && state.disliked ? state.dislikesCount - 1 : state.dislikesCount,
      }
    }
    case "TOGGLE_DISLIKE": {
      const newDisliked = !state.disliked
      return {
        ...state,
        disliked: newDisliked,
        dislikesCount: state.dislikesCount + (newDisliked ? 1 : -1),
        liked: newDisliked ? false : state.liked,
        likesCount: newDisliked && state.liked ? state.likesCount - 1 : state.likesCount,
      }
    }
    case "TOGGLE_BOOKMARK":
      return { ...state, bookmarked: !state.bookmarked }
    case "SET_FROM_PROPS":
      return {
        liked: action.payload._isLiked ?? false,
        likesCount: action.payload.likes,
        disliked: false,
        dislikesCount: action.payload.dislikes,
        bookmarked: action.payload._isBookmarked ?? false,
      }
    default:
      return state
  }
}

export default function PostCard({ post, onLike, onDislike, onBookmark, onShare, onComment, onRespond, onEdit, onDeleted, onRestored, onArchivedChanged }: PostCardProps) {
  const [state, dispatch] = useReducer(postCardReducer, {
    liked: post._isLiked ?? false,
    likesCount: post.likes,
    disliked: false,
    dislikesCount: post.dislikes,
    bookmarked: post._isBookmarked ?? false,
  })
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const auth = useContext(AuthContext)

  const routes = Array.isArray(post.routes) ? (post.routes as RouteStep[]) : []
  const vehicles = extractVehicles(post.routes)
  const tags = post.tags ?? []
  const images = post.images ?? []
  const user = post.user
  // Route requests are not routes: no map, no navigation affordance, no trust
  // score, no fare/amount (metadata-driven via MODERATION_CONFIG.routeRequestHides).
  const isRouteRequest = post.type === "ROUTE_REQUEST"
  const showMap = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.map)
  const showTrust = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.trustScore)
  const showFare = !(isRouteRequest && MODERATION_CONFIG.routeRequestHides.fare)
  const viewerId = (auth?.user as { id?: string } | null)?.id ?? null
  const viewerRole = (auth?.user as { role?: string } | null)?.role ?? null

  const handleLike = () => {
    if (!auth?.requireAuth("like routes")) return
    const newLiked = !state.liked
    dispatch({ type: "TOGGLE_LIKE" })
    onLike?.(post.id, newLiked)
  }

  const handleDislike = () => {
    if (!auth?.requireAuth("dislike routes")) return
    const newDisliked = !state.disliked
    dispatch({ type: "TOGGLE_DISLIKE" })
    onDislike?.(post.id, newDisliked)
  }

  const handleBookmarkClick = () => {
    if (!auth?.requireAuth("bookmark routes")) return
    const newBookmarked = !state.bookmarked
    dispatch({ type: "TOGGLE_BOOKMARK" })
    onBookmark?.(post.id, newBookmarked)
  }

  const handleShareClick = () => {
    if (!auth?.requireAuth("share routes")) return
    onShare?.(post.id)
  }

  const handleCommentClick = () => {
    if (!auth?.requireAuth("comment on routes")) return
    onComment?.(post.id)
  }

  const handleRespond = () => {
    if (!auth?.requireAuth("respond to route requests")) return
    onRespond?.(post)
  }

  const handleEdit = useCallback(() => {
    onEdit?.(post)
  }, [onEdit, post])

  const cardVariant = post.isPlatformGen ? "suggestion" : "default"
  const trustLevel = (post.validityTier as "low" | "developing" | "verified" | "trusted") ?? "developing"

  return (
    <AppCard variant={cardVariant} hover className={post.isPlatformGen ? "" : ""}>
      {post.isPlatformGen && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-semibold text-primary bg-primary-muted ml-4 mt-3">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.5 6L18 12l-4.5 3L12 21l-1.5-6L6 12l4.5-3z" />
            <path d="M18 3l-1.5 3L18 9" />
            <path d="M6 9l-1.5-3L6 3" />
          </svg>
          Along Suggestion
        </div>
      )}

      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <AppUserLabel
          user={{
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
            userName: user?.userName ?? "",
            avatar: user?.avatar ?? undefined,
            avatarConfig: user?.avatarConfig as { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | undefined,
          }}
          size="md"
          showHandle={true}
          linkToProfile={true}
        />
        <span className="text-xs text-text-muted ml-auto">
          {getTimeAgo(post.createdAt)}
        </span>
        <PostMenu
          post={post as unknown as PostMenuPost}
          title={post.title}
          viewerId={viewerId}
          viewerRole={viewerRole}
          requireAuth={(action) => auth?.requireAuth(action) ?? false}
          onEdit={onEdit ? handleEdit : undefined}
          onDeleted={onDeleted}
          onRestored={onRestored}
          onArchivedChanged={onArchivedChanged}
        />
      </div>

      {post.isArchived && (
        <div className="px-4 pt-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[11px] font-semibold bg-bg-elevated text-text-secondary border border-border">
            <Archive size={11} />
            Archived — only you can see this
          </span>
        </div>
      )}

      {post.type === "ROUTE_REQUEST" && (
        <div className="px-4 pt-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[11px] font-semibold bg-warning text-warning-text border border-warning-border">
            <ClipboardList size={11} />
            Route request
          </span>
        </div>
      )}

      {post.type === "ROUTE_RESPONSE" && post.quotedPost && (
        <div className="px-4 pt-1">
          <Link
            href={`/posts/${post.quotedPost.id}`}
            onClick={(e) => e.stopPropagation()}
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

      {vehicles.length > 0 && (
        <div className="flex gap-1 flex-wrap px-4 pb-2" style={{ paddingLeft: "66px" }}>
          {vehicles.map((v) => (
            <VehicleChip key={v} type={v as VehicleType} size="sm" />
          ))}
        </div>
      )}

      <div className="px-4 pb-2">
        <Link
          href={`/posts/${post.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-lg font-semibold text-text-primary no-underline hover:underline"
        >
          {post.title}
        </Link>
        {post.description && (
          <p className="text-sm text-text-secondary mt-1 line-clamp-3">{post.description}</p>
        )}
      </div>

      {post.type === "ROUTE_REQUEST" && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRespond()
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 radius-md bg-primary text-white border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-colors duration-fast"
          >
            <Reply size={14} />
            Respond to this request
          </button>
          {(post.responsesCount ?? 0) > 0 && (
            <Link
              href={`/posts/${post.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary no-underline hover:underline"
            >
              <MessagesSquare size={13} />
              View {post.responsesCount} {post.responsesCount === 1 ? "response" : "responses"}
            </Link>
          )}
        </div>
      )}

      {routes.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          {routes.map((step, index) => (
            <div key={index} className="flex items-start gap-2.5 relative">
              {index < routes.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-[-6px] w-0.5 bg-border" />
              )}
              <div className="w-5 h-5 rounded-circle bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                {step.location && (
                  <div className="text-sm font-medium text-text-primary truncate">{step.location}</div>
                )}
                {step.description && (
                  <div className="text-xs text-text-secondary mt-0.5">{step.description}</div>
                )}
                {!step.location && !step.description && (
                  <span className="text-sm text-text-muted italic">Stop {index + 1}</span>
                )}
              </div>
              {showFare && showStepFare(index, routes.length) && step.fare !== undefined && step.fare !== null && (
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1 shrink-0">
                  <BadgeDollarSign size={14} className="text-text-muted" />
                  ₦{step.fare}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap px-4 pb-2">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/explore?tag=${encodeURIComponent(tag)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-bg-elevated border border-border text-text-secondary no-underline hover:bg-primary-muted hover:text-primary hover:border-primary-muted transition-colors duration-fast"
            >
              #{tag}
            </Link>
          ))}
          {post.region && (
            <Link
              href={`/explore?region=${encodeURIComponent(post.region)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-primary-muted text-primary border border-primary-muted no-underline"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {post.region}
            </Link>
          )}
        </div>
      )}

      {/* Only render the map when real coords exist — never plot 0,0 pins (ocean).
          Route requests are not routes, so they never render a map. */}
      {showMap && post.startLat != null && post.startLng != null && (
        <div className="px-4 pb-2">
          <MiniRouteMap
            pins={(() => {
              const pins: { lat: number; lng: number; label: string; type: "origin" | "destination" | "waypoint" }[] = []
              pins.push({ lat: post.startLat!, lng: post.startLng!, label: routes[0]?.location ?? "Start", type: "origin" })
              if (post.waypoints) {
                post.waypoints.forEach((wp, i) => {
                  if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
                    pins.push({ lat: wp.lat, lng: wp.lng, label: routes[i + 1]?.location ?? "", type: "waypoint" })
                  }
                })
              }
              if (post.endLat != null && post.endLng != null) {
                pins.push({ lat: post.endLat, lng: post.endLng, label: routes[routes.length - 1]?.location ?? "End", type: "destination" })
              }
              return pins.filter((p) => !(p.lat === 0 && p.lng === 0))
            })()}
            height={100}
            showOverlay={false}
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="px-4 pb-2.5">
          {images.length === 1 && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={images[0]} alt="Route" width={400} height={200} className="w-full h-[200px] object-cover radius-sm bg-bg-elevated cursor-pointer" loading="lazy" onClick={() => setExpandedImage(images[0])} />
          )}
          {images.length === 2 && (
            <div className="grid grid-cols-2 gap-1">
              {images.map((img, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={img} alt={`Route photo ${i + 1}`} width={200} height={140} className="w-full h-[140px] object-cover radius-sm bg-bg-elevated cursor-pointer" loading="lazy" onClick={() => setExpandedImage(img)} />
              ))}
            </div>
          )}
          {images.length >= 3 && (
            <div className="grid grid-cols-2 gap-1" style={{ gridTemplateRows: "auto auto" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt="Route photo 1" width={200} height={148} className="row-span-2 w-full h-full object-cover radius-sm bg-bg-elevated cursor-pointer" loading="lazy" style={{ minHeight: "148px" }} onClick={() => setExpandedImage(images[0])} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[1]} alt="Route photo 2" width={200} height={72} className="w-full h-[72px] object-cover radius-sm bg-bg-elevated cursor-pointer" loading="lazy" onClick={() => setExpandedImage(images[1])} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[2]} alt="Route photo 3" width={200} height={72} className="w-full h-[72px] object-cover radius-sm bg-bg-elevated cursor-pointer" loading="lazy" onClick={() => setExpandedImage(images[2])} />
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      {expandedImage && (
        <ImageLightbox
          images={images}
          initialIndex={images.indexOf(expandedImage)}
          onClose={() => setExpandedImage(null)}
        />
      )}

      <div className="flex items-center gap-1 px-4 py-2 border-t border-border">
        <button
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className={`flex items-center gap-1 px-2.5 py-1.5 radius-md text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-fast border-none bg-transparent cursor-pointer font-sans ${state.liked ? "liked text-error-text" : ""}`}
          aria-label="Like"
        >
          <Heart size={16} className={state.liked ? "fill-error-text stroke-error-text" : ""} />
          {state.likesCount > 0 && <span>{formatCount(state.likesCount)}</span>}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleDislike(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 radius-md text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-fast border-none bg-transparent cursor-pointer font-sans"
          aria-label="Dislike"
        >
          <ThumbsDown size={16} />
          {state.dislikesCount > 0 && <span>{formatCount(state.dislikesCount)}</span>}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleCommentClick(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 radius-md text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-fast border-none bg-transparent cursor-pointer font-sans"
          aria-label="Comment"
        >
          <MessageCircle size={16} />
          {post.comments > 0 && <span>{formatCount(post.comments)}</span>}
        </button>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={(e) => { e.stopPropagation(); handleBookmarkClick(); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 radius-md text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-fast border-none bg-transparent cursor-pointer font-sans ${state.bookmarked ? "bookmarked text-primary" : ""}`}
            aria-label="Bookmark"
          >
            <Bookmark size={16} className={state.bookmarked ? "fill-primary stroke-primary" : ""} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleShareClick(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 radius-md text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-fast border-none bg-transparent cursor-pointer font-sans"
            aria-label="Share"
          >
            <Share2 size={16} />
          </button>

          {showTrust && <TrustBadge level={trustLevel} score={post.validityScore} size="sm" />}
        </div>
      </div>
    </AppCard>
  )
}
