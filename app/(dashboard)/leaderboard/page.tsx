"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Medal, Award, TrendingUp, Users, MapPin } from "lucide-react"
import { useTranslation } from "@/app/providers/I18nProvider"

interface LeaderboardEntry {
  rank: number
  id: string
  firstName: string
  lastName: string
  userName: string
  avatar: string | null
  rewardPoints: number
  rewardTier: string | null
  postCount: number
  followerCount: number
}

const PAGE_SIZE = 20

function getTierColor(tier: string | null): string {
  switch (tier) {
    case "platinum": return "text-purple-500"
    case "gold": return "text-yellow-500"
    case "silver": return "text-gray-400"
    case "bronze": return "text-amber-700"
    default: return "text-text-muted"
  }
}

/** English ordinal for a competition rank (1st, 2nd, 3rd, 4th … 11th, 12th, 13th …). */
function ordinal(rank: number): string {
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`
  switch (rank % 10) {
    case 1: return `${rank}st`
    case 2: return `${rank}nd`
    case 3: return `${rank}rd`
    default: return `${rank}th`
  }
}

function initialsOf(e: Pick<LeaderboardEntry, "firstName" | "lastName">): string {
  const a = e.firstName?.[0] ?? "?"
  const b = e.lastName?.[0] ?? ""
  return `${a}${b}`.toUpperCase()
}

/**
 * Podium slots in visual order (left → center → right).
 * `entryIndex` points at the points-descending entries array, so the
 * center column is always the top earner — never the runner-up.
 * Labels/icons derive from each entry's actual `rank` (competition
 * ranking, ties share a rank), so points and placement always agree.
 */
const PODIUM_SLOTS = [
  { entryIndex: 1, height: "h-24", pedestal: "bg-gray-300/30 dark:bg-gray-500/20", Icon: Medal, iconClass: "text-gray-400" },
  { entryIndex: 0, height: "h-32", pedestal: "bg-yellow-400/30 dark:bg-yellow-500/20", Icon: Trophy, iconClass: "text-yellow-500" },
  { entryIndex: 2, height: "h-20", pedestal: "bg-amber-600/30 dark:bg-amber-700/20", Icon: Award, iconClass: "text-amber-600 dark:text-amber-500" },
] as const

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="w-8 h-8 rounded-circle flex items-center justify-center shrink-0 bg-yellow-100 dark:bg-yellow-900/30" aria-label="Rank 1">
        <Trophy size={16} className="text-yellow-500" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="w-8 h-8 rounded-circle flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-800/30" aria-label="Rank 2">
        <Medal size={16} className="text-gray-400" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="w-8 h-8 rounded-circle flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30" aria-label="Rank 3">
        <Award size={16} className="text-amber-600 dark:text-amber-500" />
      </span>
    )
  }
  return (
    <span className="w-8 h-8 rounded-circle flex items-center justify-center text-xs font-bold shrink-0 bg-bg-elevated text-text-secondary">
      {rank}
    </span>
  )
}

export default function LeaderboardPage() {
  const { tf } = useTranslation()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [me, setMe] = useState<LeaderboardEntry | null>(null)
  const [jumpHighlight, setJumpHighlight] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/leaderboard?page=${page}&limit=${PAGE_SIZE}&me=1`)
        if (res.ok) {
          const data = await res.json()
          setEntries(data.leaderboard ?? [])
          setTotalPages(data.totalPages ?? 1)
          setTotal(data.total ?? 0)
          setMe(data.me ?? null)
        }
      } catch (err) {
        console.error("Failed to load leaderboard", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  // Jump to my rank: fetch the page holding my rank, then highlight my row.
  const jumpToMyRank = async () => {
    if (!me?.rank) return
    const myPage = Math.max(1, Math.ceil(me.rank / PAGE_SIZE))
    setPage(myPage)
    setJumpHighlight(true)
    setTimeout(() => setJumpHighlight(false), 3000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h1 className="text-xl font-bold text-text-primary">{tf("leaderboard.title", "Leaderboard")}</h1>
      </div>
      <p className="text-sm text-text-muted mb-5">{tf("leaderboard.subtitle", "Top contributors ranked by reward points")}</p>

      {/* Own rank + jump (large boards) */}
      {!loading && me && (
        <div className="flex items-center justify-between gap-2 mb-4 px-4 py-2.5 rounded-lg bg-primary-muted border border-primary/20">
          <span className="text-xs font-semibold text-text-primary">
            {tf("leaderboard.yourRank", "Your rank: {rank}", { rank: `#${me.rank}` })} · {tf("leaderboard.points", "{count} pts", { count: me.rewardPoints.toLocaleString() })}
          </span>
          <button
            onClick={jumpToMyRank}
            className="px-3 py-1.5 radius-pill text-xs font-semibold bg-primary text-white border-none cursor-pointer"
          >
            {tf("leaderboard.jumpToMyRank", "Jump to my rank")}
          </button>
        </div>
      )}

      {/* Top 3 podium (first page only) */}
      {!loading && page === 1 && entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6 overflow-hidden">
          {PODIUM_SLOTS.map((slot) => {
            const e = entries[slot.entryIndex]
            if (!e) return null
            const { Icon } = slot
            return (
              <div key={e.id} className="flex flex-col items-center gap-1.5 min-w-0">
                <div className="w-10 h-10 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary">
                  {initialsOf(e)}
                </div>
                <Link href={`/profile/${e.userName}`} className="text-xs font-semibold text-text-primary no-underline hover:underline text-center leading-tight truncate max-w-20">
                  {e.firstName}
                </Link>
                <div className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 font-semibold">
                  <Trophy size={12} />
                  {e.rewardPoints.toLocaleString()}
                </div>
                <div className={`w-16 ${slot.height} rounded-t-lg ${slot.pedestal} flex items-center justify-center`}>
                  <Icon size={20} className={slot.iconClass} aria-label={ordinal(e.rank)} />
                </div>
                <span className="text-[10px] text-text-muted font-medium">{ordinal(e.rank)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Leaderboard list */}
      <div className="flex flex-col gap-1.5">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-bg-elevated animate-pulse" />
          ))
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">{tf("leaderboard.empty", "No ranked contributors yet. Share a route to top the board.")}</div>
        ) : (
          (page === 1 ? entries.slice(3) : entries).map((entry) => {
            const isMe = me?.id === entry.id
            return (
              <Link
                key={entry.id}
                id={isMe ? "my-rank-row" : undefined}
                href={`/profile/${entry.userName}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-card border hover:bg-bg-elevated transition-colors no-underline ${isMe && jumpHighlight ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {initialsOf(entry)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">
                      {entry.firstName} {entry.lastName}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      <span className="flex items-center gap-0.5"><Users size={11} />{entry.followerCount}</span>
                      <span className="flex items-center gap-0.5"><MapPin size={11} />{entry.postCount} routes</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold ${getTierColor(entry.rewardTier)}`}>
                    {entry.rewardPoints.toLocaleString()}
                  </span>
                  <TrendingUp size={14} className="text-primary" />
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 radius-md text-xs font-semibold border border-border bg-bg-card cursor-pointer disabled:opacity-40"
          >
            {tf("leaderboard.prev", "Prev")}
          </button>
          <span className="text-xs text-text-muted">
            {tf("leaderboard.pageStatus", "Page {page} of {totalPages} · {total} ranked", { page, totalPages, total })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 radius-md text-xs font-semibold border border-border bg-bg-card cursor-pointer disabled:opacity-40"
          >
            {tf("leaderboard.next", "Next")}
          </button>
        </div>
      )}
    </div>
  )
}
