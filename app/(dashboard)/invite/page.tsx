"use client"

import Link from "next/link"
import React, { useState, useEffect, useCallback } from "react"
import { Gift, Copy, Check, Trophy, Users, Share2 } from "lucide-react"
import { AppCard, AppButton, AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import { useTranslation } from "@/app/providers/I18nProvider"

interface InviteData {
  inviteCode: string
  inviteCount: number
  maxInvites: number
  pointsPerInvite: number
  pointsPerAccepted: number
}

interface LeaderboardEntry {
  rank: number
  id: string
  firstName: string
  lastName: string
  userName: string
  avatar: string | null
  rewardPoints: number
  count: number
}

export default function InvitePage() {
  const { tf } = useTranslation()
  const [data, setData] = useState<InviteData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, lbRes] = await Promise.all([
          fetch("/api/invite"),
          fetch("/api/invite?section=leaderboard"),
        ])
        if (statsRes.ok) setData(await statsRes.json())
        if (lbRes.ok) {
          const lbData = await lbRes.json()
          setLeaderboard(lbData.leaderboard ?? [])
        }
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    load()
  }, [])

  const inviteUrl = data ? `${window.location.origin}/register?ref=${data.inviteCode}` : ""

  // Send-credit bonus window: the first `maxInvites` converted invites also
  // earn send points — inviting itself is unlimited (see INVITE_CONFIG).
  const bonusLeft = data ? Math.max(0, data.maxInvites - data.inviteCount) : 0

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [inviteUrl])

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated radius-md w-1/3" />
          <div className="h-24 bg-bg-elevated radius-lg" />
          <div className="h-48 bg-bg-elevated radius-lg" />
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="max-w-[680px] mx-auto px-4 py-8"><AppEmptyState {...EMPTY_STATES.error} /></div>
  }

  return (
    <div className="max-w-[680px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{tf("invite.title", "Invite Friends")}</h1>
        <p className="text-sm text-text-secondary">{tf("invite.subtitle", "Share your invite link and earn rewards")}</p>
      </div>

      <AppCard className="p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-circle bg-primary-muted flex items-center justify-center shrink-0">
            <Gift size={20} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">{tf("invite.rewards", "Your Rewards")}</div>
            <div className="text-xs text-text-muted">
              {tf("invite.perInvite", "{sent} pts per invite sent · {accepted} pts per accepted invite", { sent: data.pointsPerInvite, accepted: data.pointsPerAccepted })}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {tf("invite.bonusNote", "Invite as many friends as you like — bonus send points cover your first {max} accepted invites.", { max: data.maxInvites })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 bg-bg-card border border-border radius-md p-3 text-center">
            <div className="text-2xl font-bold text-primary">{data.inviteCount}</div>
            <div className="text-[11px] text-text-muted uppercase tracking-wider">{tf("invite.accepted", "Invites Accepted")}</div>
          </div>
          <div className="flex-1 bg-bg-card border border-border radius-md p-3 text-center">
            <div className="text-2xl font-bold text-primary">{bonusLeft}</div>
            <div className="text-[11px] text-text-muted uppercase tracking-wider">{tf("invite.bonusLeft", "Bonus Invites Left")}</div>
          </div>
        </div>

        <div className="bg-bg-elevated border border-border radius-md p-3 mb-3">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{tf("invite.yourLink", "Your invite link")}</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-bg-card border border-border radius-md px-2.5 py-2 truncate text-text-secondary">
              {inviteUrl}
            </code>
            <button
              onClick={handleCopy}
              className="w-9 h-9 rounded-md bg-primary text-text-inverse flex items-center justify-center shrink-0 cursor-pointer border-none hover:bg-primary-light transition-colors duration-fast"
              aria-label={tf("invite.copyLink", "Copy invite link")}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <AppButton
            variant="secondary"
            className="flex-1 text-xs"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "Join me on Along", url: inviteUrl }).catch(() => {})
              } else {
                handleCopy()
              }
            }}
          >
            <Share2 size={14} /> {tf("common.share", "Share")}
          </AppButton>
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-warning-text" />
          <h2 className="text-base font-semibold">Leaderboard</h2>
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-4">{tf("invite.noInvites", "No invites yet. Be the first!")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2 radius-md hover:bg-bg-elevated transition-colors duration-fast">
                <span className={`w-6 text-center text-xs font-bold ${entry.rank <= 3 ? "text-warning-text" : "text-text-muted"}`}>
                  #{entry.rank}
                </span>
                <Link href={`/profile/${entry.userName}`} className="no-underline">
                  <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {entry.firstName[0]}{entry.lastName[0]}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${entry.userName}`} className="text-sm font-semibold truncate no-underline hover:underline text-text-primary block">{entry.firstName} {entry.lastName}</Link>
                  <Link href={`/profile/${entry.userName}`} className="text-[11px] text-text-muted no-underline hover:underline block">@{entry.userName}</Link>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><Users size={12} />{entry.count}</span>
                  <span className="font-semibold text-primary">{entry.rewardPoints.toLocaleString()}pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </div>
  )
}
