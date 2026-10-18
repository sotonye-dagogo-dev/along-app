"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppAvatar, AppEmptyState, ViewMoreButton } from "@/app/components/ui"
import { PAGINATION_CONFIG } from "@/app/lib/config"
import { filterVisibleUsers } from "@/app/lib/config/userVisibility"

interface UserSummary {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar: string | null
  avatarConfig: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
  verified: boolean
  followedAt?: string
  /** Visibility flags (optional for legacy payloads — absent means visible). */
  isDeleted?: boolean | null
  deletionScheduledFor?: string | Date | null
}

interface UserListResponse {
  users?: UserSummary[] | null
  /** Cursor for the next window; absent on legacy/cached payloads (→ no more). */
  nextCursor?: string | null
}

interface UserListProps {
  userId: string
  username: string
  type: "followers" | "following"
}

export function UserList({ userId, username, type }: UserListProps) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setNextCursor(null)
    setHasMore(false)
    const load = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/${type}`)
        if (res.ok && !cancelled) {
          const data = (await res.json()) as UserListResponse
          // Server already excludes; stale caches get the same rule client-side.
          setUsers(filterVisibleUsers(data.users ?? []))
          // Legacy/cached payloads without nextCursor → hasMore stays false.
          setNextCursor(data.nextCursor ?? null)
          setHasMore(Boolean(data.nextCursor))
        }
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [userId, type])

  /** Cursor "View more" — appends the next window, deduped by user id. */
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set("cursor", nextCursor)
      params.set("limit", String(PAGINATION_CONFIG.userLists.defaultLimit))
      const res = await fetch(`/api/users/${userId}/${type}?${params.toString()}`)
      if (!res.ok) throw new Error("view more failed")
      const data = (await res.json()) as UserListResponse
      const incoming = filterVisibleUsers(data.users ?? [])
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id))
        return [...prev, ...incoming.filter((u) => !seen.has(u.id))]
      })
      // Missing nextCursor (legacy payload) ends pagination silently.
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.nextCursor))
    } catch {
      // Silent — the button stays so the user can retry.
    } finally {
      setLoadingMore(false)
    }
  }

  const heading = type === "followers" ? "Followers" : "Following"
  const emptyPreset = type === "followers" ? "followers" : "following"

  return (
    <div className="max-w-[680px] mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/profile/${username}`}
          className="w-8 h-8 rounded-circle bg-bg-elevated flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border transition-colors no-underline"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold">{heading}</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 rounded-circle bg-bg-elevated shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-bg-elevated radius-md w-1/3 mb-1" />
                <div className="h-3 bg-bg-elevated radius-md w-1/5" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <AppEmptyState preset={emptyPreset} />
      ) : (
        <div className="flex flex-col">
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/profile/${u.userName}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-elevated transition-colors no-underline"
            >
              <AppAvatar
                src={u.avatar ?? undefined}
                alt={`${u.firstName} ${u.lastName}`}
                size={40}
                config={u.avatarConfig ?? undefined}
                verified={u.verified}
                linkToProfile={false}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-text-muted truncate">@{u.userName}</p>
              </div>
            </Link>
          ))}
          <ViewMoreButton
            onViewMore={() => void loadMore()}
            loading={loadingMore}
            shown={users.length}
            total={null}
            hasMore={hasMore}
          />
        </div>
      )}
    </div>
  )
}
