'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { buildAvatarUrl, getFallbackAvatarUrl } from '@/app/lib/config/avatar'
import type { AvatarConfig } from '@/app/lib/types'

type AvatarSize = 20 | 24 | 32 | 40 | 56 | 80 | 120

const sizeMap: Record<AvatarSize, { dim: number; font: number }> = {
  20: { dim: 20, font: 9 },
  24: { dim: 24, font: 10 },
  32: { dim: 32, font: 12 },
  40: { dim: 40, font: 14 },
  56: { dim: 56, font: 20 },
  80: { dim: 80, font: 28 },
  120: { dim: 120, font: 42 },
}

interface AppAvatarProps {
  src?: string
  alt: string
  size?: AvatarSize
  config?: AvatarConfig
  verified?: boolean
  linkToProfile?: boolean
  userName?: string
  className?: string
}

function AppAvatar({
  src,
  alt,
  size = 40,
  config,
  verified = false,
  linkToProfile = true,
  userName,
  className = '',
}: AppAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const { dim, font } = sizeMap[size]
  const firstLetter = alt?.charAt(0)?.toUpperCase() ?? '?'

  const avatarUrl = src ?? (config ? buildAvatarUrl(config) : getFallbackAvatarUrl(firstLetter))

  const avatarContent = (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-circle bg-primary-muted shrink-0 ${className}`}
      style={{ width: dim, height: dim }}
    >
      {!imgError && avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={alt}
          width={dim}
          height={dim}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="font-bold text-primary select-none leading-none"
          style={{ fontSize: font }}
        >
          {firstLetter}
        </span>
      )}
      {verified && (
        <span className="absolute bottom-[-1px] right-[-1px] text-primary">
          <BadgeCheck size={14} />
        </span>
      )}
    </div>
  )

  if (linkToProfile && userName) {
    return (
      <Link
        href={`/profile/${userName}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex"
      >
        {avatarContent}
      </Link>
    )
  }

  return avatarContent
}

export { AppAvatar }
export type { AppAvatarProps, AvatarSize }

