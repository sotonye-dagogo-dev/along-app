"use client"

import Link from "next/link"
import { ClipboardList, MapPin, TrendingUp, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { AppAvatar } from "@/app/components/ui/AppAvatar"
import { FollowButton } from "@/app/components/features/suggestions/FollowButton"
import { EndlessCarousel } from "@/app/components/features/suggestions/EndlessCarousel"
import { SUGGESTIONS_PANEL_CONFIG } from "@/app/lib/config"
import { filterVisibleUsers, isVisibleUser } from "@/app/lib/config/userVisibility"
import type { SuggestionsData, SuggestionPost } from "@/app/components/features/suggestions/types"

function OpenRequestCard({ req }: { req: SuggestionPost }) {
  return (
    <Link
      href={`/posts/${req.id}`}
      className={`block ${SUGGESTIONS_PANEL_CONFIG.openRequests.cardWidthClass} bg-bg-card border border-border rounded-xl p-3 hover:border-primary-muted transition-colors`}
    >
      <div className="text-sm font-semibold line-clamp-2">{req.title}</div>
      <div className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 min-w-0">
        <AppAvatar
          src={req.user.avatar ?? undefined}
          alt={`${req.user.firstName} ${req.user.lastName}`}
          size={20}
          config={req.user.avatarConfig ?? undefined}
          verified={req.user.verified}
          linkToProfile={false}
          userName={req.user.userName}
        />
        <span className="truncate">
          @{req.user.userName}
          {req.region ? ` · ${req.region}` : ""}
        </span>
      </div>
    </Link>
  )
}

export function SuggestionsPanel() {
  const { user, isLoading: authLoading } = useAuth()
  const viewerId = user?.id ?? "guest"
  const { data, loading } = useCachedFetch<SuggestionsData>(
    `suggestions:${viewerId}`,
    "/api/suggestions",
    { ttlSec: 300, enabled: !authLoading }
  )
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const users = useMemo(
    // Server already excludes; stale caches get the same rule client-side.
    () => filterVisibleUsers(data?.users ?? []).filter((u) => !dismissed.has(u.id)),
    [data, dismissed]
  )

  // Trending tags derived from real suggested routes/requests (top 8).
  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of [...(data?.routes ?? []), ...(data?.routeRequests ?? [])]) {
      for (const tag of p.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [data])

  const requests = (data?.routeRequests ?? []).filter((p) => isVisibleUser(p.user))

  if (authLoading || (loading && !data)) {
    return (
      <aside className="hidden xl:block w-80 shrink-0 sticky top-4 self-start space-y-4" aria-label="Suggestions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-bg-card border border-border rounded-xl p-4 space-y-2.5 animate-pulse">
            <div className="h-3.5 w-28 bg-bg-elevated rounded" />
            <div className="h-9 w-full bg-bg-elevated rounded" />
            <div className="h-9 w-full bg-bg-elevated rounded" />
          </div>
        ))}
      </aside>
    )
  }

  return (
    <aside className="hidden xl:block w-80 shrink-0 sticky top-4 self-start space-y-4" aria-label="Suggestions">
      {/* Who to follow */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" />
          Who to follow
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted">No suggestions right now — check back soon.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-elevated transition-colors">
              <Link href={`/profile/${u.userName}`} className="flex items-center gap-3 min-w-0 flex-1">
                <AppAvatar
                  src={u.avatar ?? undefined}
                  alt={`${u.firstName} ${u.lastName}`}
                  size={32}
                  config={u.avatarConfig ?? undefined}
                  verified={u.verified}
                  linkToProfile={false}
                  userName={u.userName}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {u.firstName} {u.lastName}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    @{u.userName} · {u.postCount} posts
                  </div>
                </div>
              </Link>
              <FollowButton userId={u.id} target={u} onFollowed={() => setDismissed((prev) => new Set(prev).add(u.id))} />
            </div>
          ))
        )}
      </div>

      {/* Open route requests — single stays a static row; 2+ scroll in the shared endless tape */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-1.5">
          <ClipboardList size={14} className="text-secondary" />
          Open route requests
          {requests.length > 1 && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-text-muted">
              <span className="px-1.5 py-0.5 rounded-full bg-bg-elevated border border-border">
                {requests.length}
              </span>
              {SUGGESTIONS_PANEL_CONFIG.openRequests.scrollHint}
            </span>
          )}
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted">No open requests yet.</p>
        ) : requests.length === 1 ? (
          <Link
            href={`/posts/${requests[0].id}`}
            className="block px-4 py-2.5 hover:bg-bg-elevated transition-colors"
          >
            <div className="text-sm font-semibold line-clamp-1">{requests[0].title}</div>
            <div className="text-xs text-text-muted truncate">
              @{requests[0].user.userName}
              {requests[0].region ? ` · ${requests[0].region}` : ""}
            </div>
          </Link>
        ) : (
          <div className="px-3 py-3">
            <EndlessCarousel
              items={requests.map((req) => (
                <OpenRequestCard key={req.id} req={req} />
              ))}
              label={SUGGESTIONS_PANEL_CONFIG.openRequests.carouselLabel}
              durationSec={SUGGESTIONS_PANEL_CONFIG.openRequests.carouselDurationSec}
            />
          </div>
        )}
      </div>

      {/* Trending tags (from real feed data) */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-1.5">
          <TrendingUp size={14} className="text-accent-tertiary" />
          Trending tags
        </div>
        {trendingTags.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted">Tags will appear as routes come in.</p>
        ) : (
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary hover:border-primary-muted hover:text-primary transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Explore */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-1.5">
          <MapPin size={14} className="text-primary" />
          Explore routes
        </div>
        <div className="px-4 py-3 text-xs text-text-muted">
          <Link href="/explore" className="text-primary hover:underline font-semibold">
            Discover the best routes near you →
          </Link>
        </div>
      </div>
    </aside>
  )
}
