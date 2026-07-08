"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X, ThumbsUp, MessageCircle } from "lucide-react"
import { AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"

interface BookmarkedPost {
  id: string
  title: string
  tags: string[]
  likes: number
  comments: number
  createdAt: string
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
    avatarConfig?: unknown
  }
  bookmarkedAt: string
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

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/bookmarks")
        if (res.ok) {
          const data = await res.json()
          setBookmarks(data.bookmarks ?? [])
        }
      } catch {
        console.error("Failed to load bookmarks")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const removeBookmark = async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" })
      setBookmarks((prev) => prev.filter((b) => b.id !== postId))
    } catch {
      console.error("Failed to remove bookmark")
    }
  }

  return (
    <div className="max-w-[640px] mx-auto px-4">
      <div className="flex items-center justify-between py-4 border-b border-border mb-4">
        <h1 className="text-[22px] font-semibold tracking-tight">Bookmarks</h1>
        {bookmarks.length > 0 && (
          <span className="text-sm text-text-secondary">{bookmarks.length} saved</span>
        )}
      </div>

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
      ) : (
        <div className="flex flex-col gap-3">
          {bookmarks.map((bookmark) => {
            const initials = `${bookmark.user.firstName[0]}${bookmark.user.lastName[0]}`.toUpperCase()
            return (
              <div key={bookmark.id} className="bg-bg-card border border-border radius-lg p-4 relative transition-shadow duration-base hover:shadow-md group">
                <button
                  onClick={() => removeBookmark(bookmark.id)}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-circle bg-bg-elevated text-text-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-fast border-none cursor-pointer hover:text-error-text hover:bg-error"
                  aria-label="Remove bookmark"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <Link href={`/profile/${bookmark.user.userName}`} onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-circle bg-primary-muted flex items-center justify-center text-[10px] font-bold text-primary shrink-0 no-underline">
                    {initials}
                  </Link>
                  <Link href={`/profile/${bookmark.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-text-primary no-underline hover:underline flex-1">
                    {bookmark.user.firstName} {bookmark.user.lastName}
                  </Link>
                  <Link href={`/profile/${bookmark.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-xs text-text-muted no-underline hover:underline">@{bookmark.user.userName}</Link>
                </div>
                <Link href={`/posts/${bookmark.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-text-primary no-underline hover:underline mb-1.5 block">
                  {bookmark.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                  <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {formatCount(bookmark.likes)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {formatCount(bookmark.comments)}</span>
                  {bookmark.tags.slice(0, 3).map((tag) => (
                    <Link key={tag} href={`/explore?tag=${encodeURIComponent(tag)}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 radius-pill text-[10px] font-medium bg-bg-elevated text-text-secondary no-underline">
                      #{tag}
                    </Link>
                  ))}
                  <span>Saved · {getTimeAgo(bookmark.createdAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
