"use client"

import Link from "next/link"
import { MapPin, Heart } from "lucide-react"

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

interface ExplorePinCardUser {
  userName: string
  firstName: string
  lastName: string
}

export interface ExplorePinCardProps {
  id: string
  title: string
  user: ExplorePinCardUser
  validityScore: number
  validityTier: string | null
  tags: string[]
  likes: number
  createdAt: string
}

export function ExplorePinCard({ id, title, user, validityScore, validityTier, tags, likes }: ExplorePinCardProps) {
  return (
    <Link
      href={`/posts/${id}`}
      className="bg-bg-card border border-border radius-lg p-3 cursor-pointer transition-shadow duration-base hover:shadow-md no-underline block"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Link href={`/profile/${user.userName}`} onClick={(e) => e.stopPropagation()} className="no-underline">
          <div className="w-6 h-6 rounded-circle bg-primary-muted flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
            {user.firstName[0]}{user.lastName[0]}
          </div>
        </Link>
        <Link href={`/profile/${user.userName}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-text-primary flex-1 no-underline hover:underline">
          {user.firstName} {user.lastName}
        </Link>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 radius-pill text-[10px] font-semibold ${
          (validityTier ?? "developing") === "verified" ? "bg-success text-success-text" :
          (validityTier ?? "developing") === "trusted" ? "bg-info text-info-text" :
          (validityTier ?? "developing") === "low" ? "bg-error text-error-text" :
          "bg-warning text-warning-text"
        }`}>
          {validityScore}
        </span>
      </div>
      <div className="text-xs font-semibold text-text-primary mb-1">{title}</div>
      <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
        <span className="flex items-center gap-0.5"><MapPin size={11} />{tags.length} steps</span>
        <span className="flex items-center gap-0.5"><Heart size={11} />{formatCount(likes)}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {tags.slice(0, 2).map((t) => (
          <Link key={t} href={`/explore?tag=${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()} className="inline-flex px-1.5 py-0.5 radius-pill text-[10px] font-medium bg-bg-elevated text-text-secondary no-underline hover:bg-primary-muted hover:text-primary">
            #{t}
          </Link>
        ))}
      </div>
    </Link>
  )
}
