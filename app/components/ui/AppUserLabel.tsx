'use client'

import React from 'react'
import Link from 'next/link'
import { BadgeCheck, Star, Award, Trophy } from 'lucide-react'
import { REWARD_TIERS } from '@/app/lib/config/rewards'
import { AppAvatar } from './AppAvatar'

const tierIconMap: Record<string, React.ElementType> = {
  Star,
  Award,
  Trophy,
}

/**
 * Theme-safe tier icon colours (design-system §colour-palette, WCAG AA).
 * Raw metallic hues (SILVER #C0C0C0, GOLD #FFD700, PLATINUM #E5E4E2) are
 * invisible on the light card in light theme, so icons render in these
 * darkened display shades instead — same hue family, guaranteed contrast
 * on both `bg-bg-card` (light) and `bg-bg-card-dark` (dark).
 */
const tierIconColorMap: Record<string, string> = {
  BRONZE: '#92400E',
  SILVER: '#64748B',
  GOLD: '#A16207',
  PLATINUM: '#6B7280',
}

interface UserLabelUser {
  firstName: string
  lastName: string
  userName: string
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string }
  avatar?: string
  isVerified?: boolean
  rewardTier?: string
}

interface AppUserLabelProps {
  user: UserLabelUser
  size?: 'sm' | 'md'
  vertical?: boolean
  showHandle?: boolean
  linkToProfile?: boolean
  /**
   * Optional role tag (e.g. "Admin" / "Mod") rendered under the name.
   * Used by the admin sidebar so one modular component owns the
   * avatar + profile-link behaviour everywhere.
   */
  roleLabel?: string | null
  hideTier?: boolean
}

function AppUserLabel({
  user,
  size = 'md',
  vertical = false,
  showHandle = true,
  linkToProfile = true,
  roleLabel = null,
  hideTier = false,
}: AppUserLabelProps) {
  const avatarSize = size === 'sm' ? 24 : 32
  const displayName = `${user.firstName} ${user.lastName}`

  const tier = user.rewardTier ? REWARD_TIERS[user.rewardTier] : null
  const TierIcon = tier ? tierIconMap[tier.icon] ?? Star : null

  const content = (
    <div
      className={`inline-flex gap-2 ${vertical ? 'flex-col items-center text-center' : 'items-center'}`}
    >
      <AppAvatar
        src={user.avatar}
        alt={displayName}
        size={avatarSize}
        config={user.avatarConfig}
        verified={user.isVerified}
        linkToProfile={false}
        userName={user.userName}
      />
      <div className={vertical ? '' : ''}>
        <div className={`flex items-center gap-1 ${vertical ? 'justify-center' : ''}`}>
          <span className="text-sm font-semibold text-text-primary leading-tight">
            {displayName}
          </span>
          {user.isVerified && (
            <BadgeCheck size={14} className="text-primary shrink-0" />
          )}
          {tier && TierIcon && !hideTier && (
            <TierIcon
              size={12}
              className="shrink-0"
              aria-label={`${tier.label} tier shield`}
              style={{ color: tierIconColorMap[user.rewardTier!] ?? tier.color }}
            />
          )}
          {roleLabel && (
            <span className="inline-block px-1.5 py-0.5 radius-pill text-[10px] font-semibold bg-error text-error-text uppercase tracking-wider">
              {roleLabel}
            </span>
          )}
        </div>
        {showHandle && (
          <p className="text-xs text-text-secondary leading-tight">
            @{user.userName}
          </p>
        )}
      </div>
    </div>
  )

  if (linkToProfile) {
    return (
      <Link
        href={`/profile/${user.userName}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex"
      >
        {content}
      </Link>
    )
  }

  return content
}

export { AppUserLabel }
export type { AppUserLabelProps, UserLabelUser }
