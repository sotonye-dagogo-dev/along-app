'use client'

import React from 'react'
import Link from 'next/link'
import { Star, Award, Trophy, TrendingUp, UserPlus, Gift, History } from 'lucide-react'
import { REWARD_TIERS, rewardTierPillClass } from '@/app/lib/config'

interface RewardHistoryItem {
  id: string
  action: string
  points: number
  createdAt: Date
}

interface RewardsPanelProps {
  tier: string
  points: number
  nextTierLabel?: string
  nextTierPoints?: number
  recentActivity?: string
  history?: RewardHistoryItem[]
}

const tierIcons: Record<string, React.ReactNode> = {
  BRONZE: <Star size={12} />,
  SILVER: <Star size={12} />,
  GOLD: <Award size={12} />,
  PLATINUM: <Trophy size={12} />,
}

function RewardsPanel({ tier, points, nextTierLabel, nextTierPoints, recentActivity, history }: RewardsPanelProps) {
  const tierConfig = REWARD_TIERS[tier]

  const tiers = Object.entries(REWARD_TIERS).sort(([, a], [, b]) => a.minPoints - b.minPoints)
  const currentIndex = tiers.findIndex(([key]) => key === tier)
  const nextTier = tiers[currentIndex + 1]
  const label = nextTierLabel ?? nextTier?.[1].label ?? 'Max'
  const maxPoints = nextTierPoints ?? nextTier?.[1].minPoints ?? points
  const progress = Math.min((points / maxPoints) * 100, 100)

  return (
    <div className="bg-bg-elevated border border-border radius-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span
          title={`${tierConfig?.label ?? tier} tier shield`}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 radius-pill text-xs font-semibold border ${rewardTierPillClass(tier)}`}
        >
          {tierIcons[tier] ?? <Star size={12} />}
          {tierConfig?.label ?? tier} Shield
        </span>
        <span className="text-2xl font-bold text-text-primary">
          {points.toLocaleString()} <span className="text-sm font-normal text-text-muted">pts</span>
        </span>
      </div>
      {nextTier && (
        <>
          <div className="h-1.5 bg-border radius-pill overflow-hidden mb-1">
            <div
              className="h-full radius-pill bg-gradient-to-r from-primary to-warning-border transition-all duration-moderate"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mb-2.5">
            <span>{points.toLocaleString()} / {maxPoints.toLocaleString()}</span>
            <span>{label}</span>
          </div>
        </>
      )}
      {recentActivity && !history && (
        <div className="pt-2.5 border-t border-border text-xs text-text-secondary flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <span dangerouslySetInnerHTML={{ __html: recentActivity }} />
        </div>
      )}
      {history && history.length > 0 && (
        <div className="pt-2.5 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <History size={12} className="text-text-muted" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Recent Activity</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary truncate">{item.action}</span>
                <span className="font-semibold text-primary">+{item.points}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2.5 pt-2.5 border-t border-border">
        <Link
          href="/invite"
          className="flex items-center gap-2 px-3 py-2 radius-md bg-primary-muted text-primary text-xs font-semibold hover:bg-primary hover:text-text-inverse transition-all duration-fast no-underline"
        >
          <UserPlus size={14} />
          <span>Invite friends & earn <Gift size={12} className="inline" /> points</span>
        </Link>
      </div>
    </div>
  )
}

export { RewardsPanel }
