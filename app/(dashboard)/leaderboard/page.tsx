"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Medal, TrendingUp, Users, MapPin } from "lucide-react"
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

function getRankBadge(rank: number): { icon: string; bg: string } {
  if (rank === 1) return { icon: "🥇", bg: "bg-yellow-100 dark:bg-yellow-900/30" }
  if (rank === 2) return { icon: "🥈", bg: "bg-gray-100 dark:bg-gray-800/30" }
  if (rank === 3) return { icon: "🥉", bg: "bg-amber-100 dark:bg-amber-900/30" }
  return { icon: `#${rank}`, bg: "bg-bg-elevated" }
}

export default function LeaderboardPage() {
  const { tf } = useTranslation()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<"all" | "month" | "week">("all")
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
  }, [period, page])

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

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-5">
        {(["all", "month", "week"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 radius-pill text-xs font-medium border font-sans cursor-pointer transition-all duration-fast ${
              period === p
                ? "bg-primary text-white border-primary"
                : "bg-bg-card text-text-secondary border-border hover:border-primary-muted"
            }`}
          >
            {p === "all" ? "All time" : p === "month" ? "This month" : "This week"}
          </button>
        ))}
      </div>

      {/* Own rank + jump (large boards) */}
      {!loading && me && (
        <div className="flex items-center justify-between gap-2 mb-4 px-4 py-2.5 rounded-lg bg-primary-muted border border-primary/20">
          <span className="text-xs font-semibold text-text-primary">
            {tf("leaderboard.yourRank", "Your rank")}: #{me.rank} · {me.rewardPoints.toLocaleString()} pts
          </span>
          <button
            onClick={jumpToMyRank}
            className="px-3 py-1.5 radius-pill text-xs font-semibold bg-primary text-white border-none cursor-pointer"
          >
            Jump to my rank
          </button>
        </div>
      )}

      {/* Top 3 podium (first page only) */}
      {!loading && page === 1 && entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {[1, 0, 2].map((i) => {
            const e = entries[i]
            const heights = ["h-24", "h-32", "h-20"]
            const labels = ["2nd", "1st", "3rd"]
            return (
              <div key={e.id} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary">
                  {e.firstName[0]}{e.lastName[0]}
                </div>
                <Link href={`/profile/${e.userName}`} className="text-xs font-semibold text-text-primary no-underline hover:underline text-center leading-tight">
                  {e.firstName}
                </Link>
                <div className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 font-semibold">
                  <Trophy size={12} />
                  {e.rewardPoints.toLocaleString()}
                </div>
                <div className={`w-16 ${heights[i]} rounded-t-lg ${i === 1 ? "bg-yellow-400/30 dark:bg-yellow-500/20" : i === 0 ? "bg-gray-300/30 dark:bg-gray-500/20" : "bg-amber-600/30 dark:bg-amber-700/20"} flex items-center justify-center`}>
                  <span className="text-lg">{["🥈", "🥇", "🥉"][i]}</span>
                </div>
                <span className="text-[10px] text-text-muted font-medium">{labels[i]}</span>
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
            const badge = getRankBadge(entry.rank)
            const isMe = me?.id === entry.id
            return (
              <Link
                key={entry.id}
                id={isMe ? "my-rank-row" : undefined}
                href={`/profile/${entry.userName}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-card border hover:bg-bg-elevated transition-colors no-underline ${isMe && jumpHighlight ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              >
                <div className={`w-8 h-8 rounded-circle flex items-center justify-center text-xs font-bold shrink-0 ${badge.bg} ${entry.rank <= 3 ? "" : "text-text-secondary"}`}>
                  {badge.icon}
                </div>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {entry.firstName[0]}{entry.lastName[0]}
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
            Prev
          </button>
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages} · {total} ranked
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 radius-md text-xs font-semibold border border-border bg-bg-card cursor-pointer disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
