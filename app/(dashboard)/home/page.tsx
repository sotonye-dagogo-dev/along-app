"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { PostCard } from "@/app/components/features/posts"

const ShareRouteModal = dynamic(() => import("@/app/components/features/posts/ShareRouteModal"), { ssr: false })
import { AppEmptyState, PostCardSkeleton } from "@/app/components/ui"
import SuggestionsPanel from "@/app/components/ui/SuggestionsPanel"
import { EMPTY_STATES } from "@/app/lib/config"
import { useAuth } from "@/app/hooks/useAuth"
import { useFeedInteractions } from "@/app/hooks/useFeedInteractions"
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

function HomeContent() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("share") === "true") {
      setShowShareModal(true)
    }
  }, [searchParams])

  useEffect(() => {
    const init = async () => {
      const state = await feedStream.loadInitial()
      setPosts(state.posts)
      setHasMore(state.hasMore)
      setLoading(false)
    }
    init()

    const sub = feedStream.feedState$.subscribe((state) => {
      setPosts(state.posts)
      setHasMore(state.hasMore)
      setLoading(state.loading)
    })

    return () => {
      sub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const sub = feedStream.feedState$.subscribe((state) => {
      if (state.posts.length > 0 && !state.loading) {
        const currentIds = new Set(posts.map((p) => p.id))
        const fresh = state.posts.filter((p) => !currentIds.has(p.id))
        if (fresh.length > 0) {
          setNewPostsCount(fresh.length)
        }
      }
    })
    return () => sub.unsubscribe()
  }, [posts])

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

  const initials = user
    ? `${(user.firstName as string)?.[0] ?? ""}${(user.lastName as string)?.[0] ?? ""}`.toUpperCase()
    : "?"

  return (
    <>
      <div className="flex justify-center">
        <div className="max-w-[640px] w-full px-4 py-4 flex flex-col gap-3">
        {newPostsCount > 0 && (
          <button
            onClick={refreshFeed}
            className="sticky top-0 z-10 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold cursor-pointer radius-lg shadow-md border-none mb-2 animate-[slideDown_300ms_ease-out]"
          >
            <RefreshCw size={16} />
            {newPostsCount} new {newPostsCount === 1 ? "post" : "posts"}
          </button>
        )}

        <div
          onClick={() => setShowShareModal(true)}
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
        </div>

        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as never}
              onLike={handleLike}
              onDislike={handleDislike}
              onBookmark={handleBookmark}
              onComment={handleComment}
            />
          ))
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)
        ) : (
          <AppEmptyState {...EMPTY_STATES.feed} />
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
        onClose={() => setShowShareModal(false)}
        onSubmit={async (data) => {
          try {
            const res = await fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            })
            if (res.ok) {
              refreshFeed()
            }
          } catch {
            console.error("Failed to create post")
          }
        }}
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
