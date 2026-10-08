"use client"

import Link from "next/link"
import { ClipboardList, MapPin, TrendingUp, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { FollowButton } from "@/app/components/features/suggestions/FollowButton"
import type { SuggestionsData } from "@/app/components/features/suggestions/types"

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  const initial = (name?.[0] ?? "?").toUpperCase()
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt={name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-primary-muted text-primary flex items-center justify-center text-sm font-bold shrink-0">
      {initial}
    </div>
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
    () => (data?.users ?? []).filter((u) => !dismissed.has(u.id)),
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

  const requests = data?.routeRequests ?? []

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
                <Avatar name={u.userName} avatar={u.avatar} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {u.firstName} {u.lastName}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    @{u.userName} · {u.postCount} posts
                  </div>
                </div>
              </Link>
              <FollowButton userId={u.id} onFollowed={() => setDismissed((prev) => new Set(prev).add(u.id))} />
            </div>
          ))
        )}
      </div>

      {/* Open route requests */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-1.5">
          <ClipboardList size={14} className="text-secondary" />
          Open route requests
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted">No open requests yet.</p>
        ) : (
          requests.map((req) => (
            <Link
              key={req.id}
              href={`/posts/${req.id}`}
              className="block px-4 py-2.5 hover:bg-bg-elevated transition-colors"
            >
              <div className="text-sm font-semibold line-clamp-1">{req.title}</div>
              <div className="text-xs text-text-muted truncate">
                @{req.user.userName}
                {req.region ? ` · ${req.region}` : ""}
              </div>
            </Link>
          ))
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
