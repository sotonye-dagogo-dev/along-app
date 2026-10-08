"use client"

import Link from "next/link"
import { ClipboardList, MapPin, Users, Sparkles } from "lucide-react"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { EndlessCarousel } from "./EndlessCarousel"
import { ENDLESS_CAROUSEL_CONFIG } from "@/app/lib/config"
import { FollowButton } from "./FollowButton"
import type { SuggestionsData, SuggestionPost, SuggestionUser } from "./types"

type Card = { key: string; node: React.ReactNode }

function RequestCard({ post }: { post: SuggestionPost }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block w-[240px] sm:w-[280px] bg-bg-card border border-border rounded-xl p-3 hover:border-primary-muted transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary mb-1.5">
        <ClipboardList size={12} />
        Route request
      </div>
      <div className="text-sm font-semibold line-clamp-2">{post.title}</div>
      <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-circle bg-primary-muted text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
          {(post.user.firstName?.[0] ?? post.user.userName?.[0] ?? "?").toUpperCase()}
        </span>
        <span className="truncate">@{post.user.userName}</span>
      </div>
    </Link>
  )
}

function RouteCard({ post }: { post: SuggestionPost }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block w-[240px] sm:w-[280px] bg-bg-card border border-border rounded-xl p-3 hover:border-primary-muted transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-secondary mb-1.5">
        <MapPin size={12} />
        Route
      </div>
      <div className="text-sm font-semibold line-clamp-2">{post.title}</div>
      <div className="text-xs text-text-muted mt-1.5 flex items-center gap-2">
        {post.region && <span className="truncate">{post.region}</span>}
        {post.totalDistanceKm != null && <span>{Math.round(post.totalDistanceKm)} km</span>}
      </div>
    </Link>
  )
}

function UserCard({ user }: { user: SuggestionUser }) {
  return (
    <div className="w-[240px] sm:w-[280px] bg-bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
      <Link href={`/profile/${user.userName}`} className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="w-9 h-9 rounded-circle bg-primary-muted text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {(user.firstName?.[0] ?? user.userName?.[0] ?? "?").toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold truncate">{user.firstName} {user.lastName}</span>
          <span className="block text-xs text-text-muted truncate">@{user.userName}</span>
        </span>
      </Link>
      <FollowButton userId={user.id} />
    </div>
  )
}

/**
 * Mobile-only suggestions tape (xl:hidden) shown under the home feed.
 * Data comes from the same cached GET /api/suggestions endpoint as the desktop panel.
 */
export function SuggestionsRail() {
  const { user, isLoading: authLoading } = useAuth()
  const viewerId = user?.id ?? "guest"
  const { data, loading } = useCachedFetch<SuggestionsData>(`suggestions:${viewerId}`, "/api/suggestions", { ttlSec: 300, enabled: !authLoading })

  if (authLoading || (loading && !data)) return null

  // Real data only: cards are built exclusively from GET /api/suggestions.
  // Mock/synthetic fallback is disabled (ENDLESS_CAROUSEL_CONFIG.allowMockFallback
  // stays false), so production with an empty feed renders nothing — never mock content.
  const cards: Card[] = [
    ...(data?.routeRequests ?? []).map((p) => ({ key: `req-${p.id}`, node: <RequestCard post={p} /> })),
    ...(data?.routes ?? []).map((p) => ({ key: `route-${p.id}`, node: <RouteCard post={p} /> })),
    ...(data?.users ?? []).map((u) => ({ key: `user-${u.id}`, node: <UserCard user={u} /> })),
  ]

  if (cards.length === 0) return null

  return (
    <section className="xl:hidden mt-4 w-full min-w-0 max-w-full overflow-hidden" aria-label="Suggestions">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles size={14} className="text-primary" />
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Suggested for you</h2>
        <span className="text-[10px] text-text-muted inline-flex items-center gap-1 ml-auto">
          <Users size={11} /> swipe
        </span>
      </div>
      <EndlessCarousel items={cards.map((c) => c.node)} label="Suggested routes and users" durationSec={ENDLESS_CAROUSEL_CONFIG.mobileDurationSec} />
    </section>
  )
}
