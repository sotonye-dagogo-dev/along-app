"use client"

import { useState, useEffect, useMemo } from "react"
import { Search } from "lucide-react"
import { AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import { ProfilePostCard } from "@/app/components/features/profile/ProfilePostCard"

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

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/bookmarks")
        if (res.ok) {
          const data = await res.json()
          setBookmarks(data.posts ?? data.bookmarks ?? [])
        }
      } catch {
        console.error("Failed to load bookmarks")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Client-side filter — title, description, tags, author (config-free,
  // non-breaking; server list stays the source of truth).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bookmarks
    return bookmarks.filter((b) => {
      const post = b as {
        title?: string; description?: string | null; tags?: string[]
        user?: { userName?: string; firstName?: string; lastName?: string }
      }
      return (
        (post.title ?? "").toLowerCase().includes(q) ||
        (post.description ?? "").toLowerCase().includes(q) ||
        (post.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (post.user?.userName ?? "").toLowerCase().includes(q) ||
        (`${post.user?.firstName ?? ""} ${post.user?.lastName ?? ""}`.toLowerCase().includes(q))
      )
    })
  }, [bookmarks, query])

  return (
    <div className="max-w-[640px] mx-auto px-4">
      <div className="flex items-center justify-between py-4 border-b border-border mb-4">
        <h1 className="text-[22px] font-semibold tracking-tight">Bookmarks</h1>
        {bookmarks.length > 0 && (
          <span className="text-sm text-text-secondary">{bookmarks.length} saved</span>
        )}
      </div>

      {/* Search through saved posts (parity with profile tabs). */}
      {!loading && bookmarks.length > 0 && (
        <div className="relative mb-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved posts…"
            aria-label="Search saved posts"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-bg-card text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border radius-lg p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-circle bg-bg-elevated" />
                <div className="h-3 bg-bg-elevated radius-md w-32" />
              </div>
              <div className="h-4 bg-bg-elevated radius-md w-3/4 mb-2" />
              <div className="h-3 bg-bg-elevated radius-md w-1/2" />
            </div>
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="py-8">
          <AppEmptyState {...EMPTY_STATES.bookmarks} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8">
          <AppEmptyState {...EMPTY_STATES.search} title="No matches" description={`Nothing saved matches “${query.trim()}”.`} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((bookmark) => {
            const b = bookmark as unknown as {
              id: string
              bookmarkedAt?: string
              createdAt: string
            }
            return (
              <div key={b.id}>
                <ProfilePostCard
                  post={{ ...(bookmark as object), _isBookmarked: true } as never}
                  onRemoved={(postId) =>
                    setBookmarks((prev) => prev.filter((x) => (x as { id: string }).id !== postId))
                  }
                />
                <p className="text-[11px] text-text-muted mt-1 px-1">
                  Saved · {getTimeAgo(b.bookmarkedAt ?? b.createdAt)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
