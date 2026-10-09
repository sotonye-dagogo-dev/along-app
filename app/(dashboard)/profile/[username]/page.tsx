"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { UserMinus, UserPlus, UserCheck } from "lucide-react"
import { AppAvatar, AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { ProfilePostCard } from "@/app/components/features/profile/ProfilePostCard"
import { EarlyAdopterBadgeFromStatus } from "@/app/components/features/profile"
import { ReviewsPanel } from "@/app/components/features/reviews"

interface EarlyAdopterPayload {
  enabled: boolean
  limit: number
  rank: number | null
  isEarlyAdopter: boolean
  label: string | null
}

interface ProfileData {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar: string | null
  avatarConfig: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
  bio: string | null
  verified: boolean
  rewardPoints: number
  rewardTier: string
  postCount: number
  followerCount: number
  followingCount: number
  avgValidityScore: number
  earlyAdopter?: EarlyAdopterPayload | null
}

interface PostItem {
  id: string
  title: string
  description?: string | null
  routes?: unknown
  images?: string[]
  tags: string[]
  likes: number
  dislikes?: number
  comments: number
  bookmarks?: number
  validityScore?: number
  validityTier?: string | null
  createdAt: string
  type?: "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE"
  user: { id?: string; userName: string; firstName: string; lastName: string }
}

interface ProfileApiResponse {
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar: string | null
    avatarConfig: ProfileData["avatarConfig"]
    bio: string | null
    verified: boolean
    rewardPoints: number
    rewardTier: string
    _count: { posts: number; followers: number; following: number }
  }
  isFollowing?: boolean
  earlyAdopter?: EarlyAdopterPayload | null
  isDeleted?: boolean
}

export default function OtherProfilePage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState("posts")
  const [mutualCount] = useState(0)

  const userName = params.username as string
  const { user: viewer, isLoading: authLoading } = useAuth()
  const ready = !authLoading && Boolean(userName)
  const viewerId = viewer?.id ?? "guest"

  // isFollowing is viewer-specific → cache key is viewer-scoped
  const { data: profileRes, loading: profileLoading, mutate: mutateProfile } = useCachedFetch<ProfileApiResponse>(
    ready ? `profile:${viewerId}:${userName}` : null,
    `/api/users/by-username/${encodeURIComponent(userName)}`,
    { ttlSec: 120, enabled: ready }
  )
  // Per-tab post lists for this profile (posts / routes / requests / liked).
  // "routes" = actual routes (ROUTE + ROUTE_RESPONSE); requests live on
  // their own tab so they never masquerade as routes. The reviews tab owns
  // no post query — ReviewsPanel fetches the author's platform review.
  const profileId = profileRes?.user?.id
  const tabQuery = !profileId
    ? "/api/posts?limit=20"
    : activeTab === "reviews"
      ? "/api/reviews?limit=1"
      : activeTab === "liked"
      ? `/api/posts?limit=20&likedBy=${profileId}`
      : activeTab === "routes"
        ? `/api/posts?limit=20&userId=${profileId}&type=ROUTE,ROUTE_RESPONSE`
        : activeTab === "requests"
          ? `/api/posts?limit=20&userId=${profileId}&type=ROUTE_REQUEST`
          : `/api/posts?limit=20&userId=${profileId}`
  const { data: postsData, loading: postsLoading, mutate: mutatePosts } = useCachedFetch<{ posts: PostItem[] }>(
    ready && profileId ? `profile-tab:${profileId}:${activeTab}` : null,
    tabQuery,
    { ttlSec: 120, enabled: ready && activeTab !== "reviews" }
  )

  const profile = useMemo<ProfileData | null>(() => {
    const u = profileRes?.user
    if (!u) return null
    return {
      id: u.id,
      userName: u.userName,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar,
      avatarConfig: u.avatarConfig,
      bio: u.bio,
      verified: u.verified,
      rewardPoints: u.rewardPoints,
      rewardTier: u.rewardTier,
      postCount: u._count.posts,
      followerCount: u._count.followers,
      followingCount: u._count.following,
      avgValidityScore: u._count.posts > 0 ? Math.round(u.rewardPoints / u._count.posts) : 0,
      earlyAdopter: profileRes?.earlyAdopter ?? null,
    }
  }, [profileRes])

  const isFollowing = profileRes?.isFollowing ?? false

  const posts = useMemo(() => {
    // Deleted users have no personalized tabs — likes/bookmarks always empty.
    if ((profileRes as { isDeleted?: boolean } | undefined)?.isDeleted && (activeTab === "liked")) return []
    return (postsData?.posts ?? []).filter((p) => p.user.userName === userName)
  }, [postsData, userName, profileRes, activeTab])

  const loading = authLoading || profileLoading

  const handleFollow = async () => {
    if (!profileRes) return
    const newFollowing = !isFollowing
    const prev = profileRes
    mutateProfile({
      ...profileRes,
      isFollowing: newFollowing,
      user: {
        ...profileRes.user,
        _count: {
          ...profileRes.user._count,
          followers: profileRes.user._count.followers + (newFollowing ? 1 : -1),
        },
      },
    })
    try {
      const res = await fetch(`/api/users/${profileRes.user.id}/follow`, {
        method: newFollowing ? "POST" : "DELETE",
      })
      if (!res.ok) mutateProfile(prev)
    } catch {
      mutateProfile(prev)
    }
  }

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-[180px] bg-bg-elevated radius-lg mb-4" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-20 h-20 rounded-circle bg-bg-elevated" />
            <div className="flex-1"><div className="h-5 bg-bg-elevated radius-md w-1/2 mb-2" /><div className="h-3 bg-bg-elevated radius-md w-1/4" /></div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <div className="max-w-[680px] mx-auto px-4 py-8"><AppEmptyState {...EMPTY_STATES.error} /></div>
  }

  const isDeletedProfile = Boolean((profileRes as { isDeleted?: boolean } | undefined)?.isDeleted)

  return (
    <div className="max-w-[680px] mx-auto px-4 py-4">
      <div className="h-[180px] bg-gradient-to-br from-primary-dark to-primary radius-lg mb-0 relative" />

      <div className="relative px-5">
        <div className="flex items-end gap-4 -mt-10 mb-3">
          <AppAvatar
            src={profile.avatar ?? undefined}
            alt={`${profile.firstName} ${profile.lastName}`}
            size={80}
            config={profile.avatarConfig ?? undefined}
            verified={profile.verified}
            linkToProfile={false}
            className="border-3 border-bg-base"
          />
        </div>

        <div className="mb-1">
          <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-1.5 flex-wrap">
            {profile.firstName} {profile.lastName}
            {profile.verified && (
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-primary stroke-primary stroke-[1.5]">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            <EarlyAdopterBadgeFromStatus earlyAdopter={profile.earlyAdopter} />
          </h1>
          <p className="text-sm text-text-secondary mb-1.5">@{profile.userName}</p>
        </div>

        {profile.bio && (
          <p className="text-sm text-text-primary leading-relaxed mb-3.5 max-w-full">{profile.bio}</p>
        )}

        <div className="flex items-center py-3.5 border-t border-border border-b mb-3.5">
          {[
            { num: profile.postCount, label: "Posts" },
            { num: profile.followerCount, label: "Followers", href: `/profile/${profile.userName}/followers` },
            { num: profile.followingCount, label: "Following", href: `/profile/${profile.userName}/following` },
            { num: profile.avgValidityScore, label: "Avg Score" },
          ].map((s, i, arr) => (
            <div key={s.label} className="flex-1 text-center">
              {s.href ? (
                <Link href={s.href} className="no-underline inline-block hover:opacity-80 transition-opacity">
                  <span className="text-lg font-bold text-text-primary block leading-tight">{s.num.toLocaleString()}</span>
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{s.label}</span>
                </Link>
              ) : (
                <>
                  <span className="text-lg font-bold text-text-primary block leading-tight">{s.num.toLocaleString()}</span>
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{s.label}</span>
                </>
              )}
              {i < arr.length - 1 && <div className="w-px h-8 bg-border shrink-0 inline-block ml-0" />}
            </div>
          ))}
        </div>

        {isDeletedProfile && (
          <div className="mb-3.5 rounded-lg border border-border bg-bg-elevated px-4 py-3 text-xs text-text-secondary leading-relaxed">
            This account has been deleted. Posts shown are anonymised and retained for platform integrity;
            likes and bookmarks are not available for deleted users.
          </div>
        )}

        <div className="flex gap-2 mb-3.5">
          {!isDeletedProfile && (
          <button
            onClick={handleFollow}
            className={`flex-1 h-9 px-4 radius-md text-sm font-semibold cursor-pointer font-sans inline-flex items-center justify-center gap-1.5 transition-all duration-fast ${
              isFollowing
                ? "bg-bg-elevated border border-border text-text-primary hover:bg-error hover:border-error-border hover:text-error-text"
                : "bg-primary border-none text-white hover:bg-primary-light hover:shadow-primary"
            }`}
          >
            {isFollowing ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck size={14} />
                  Following
                </span>
                <span className="hidden group-hover:inline-flex items-center gap-1.5">
                  <UserMinus size={14} />
                  Unfollow
                </span>
              </>
            ) : (
              <><UserPlus size={14} /> Follow</>
            )}
          </button>
          )}
        </div>

        {isFollowing && mutualCount > 0 && (
          <p className="text-xs text-text-muted mb-3.5">{mutualCount} mutual follows</p>
        )}

        <div
          role="tablist"
          aria-label="Profile content"
          className="flex gap-1 sm:gap-2 border-b border-border mb-4 overflow-x-auto overscroll-x-contain pb-px -mx-1 px-1 scrollbar-thin"
        >
          {["posts", "routes", "requests", "liked", "reviews"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[96px] sm:min-w-[120px] shrink-0 px-3 sm:px-4 py-3 text-center border-none bg-transparent text-sm font-medium cursor-pointer font-sans transition-colors duration-fast relative whitespace-nowrap overflow-hidden text-ellipsis ${
                activeTab === tab ? "text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-[20%] right-[20%] h-[2.5px] bg-primary radius-pill radius-pill-top" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:gap-4 pb-8 min-w-0">
          {activeTab === "reviews" && profileId ? (
            <ReviewsPanel showForm={false} authorId={profileId} />
          ) : (
            <>
          {posts.length === 0 && !postsLoading && (
            <AppEmptyState {...EMPTY_STATES.feed} />
          )}
          {posts.map((post) => (
            <ProfilePostCard
              key={post.id}
              post={
                {
                  id: post.id,
                  title: post.title,
                  description: post.description ?? null,
                  type: post.type,
                  routes: post.routes ?? [],
                  images: post.images ?? [],
                  tags: post.tags ?? [],
                  likes: post.likes ?? 0,
                  dislikes: post.dislikes ?? 0,
                  comments: post.comments ?? 0,
                  bookmarks: post.bookmarks ?? 0,
                  validityScore: post.validityScore ?? 0,
                  validityTier: post.validityTier ?? null,
                  createdAt: post.createdAt,
                  user: {
                    id: post.user.id ?? profile.id,
                    userName: profile.userName,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    avatar: profile.avatar,
                    avatarConfig: profile.avatarConfig ?? undefined,
                  },
                } as never
              }
              onRemoved={(postId) =>
                mutatePosts((prev) =>
                  prev ? { posts: prev.posts.filter((p) => p.id !== postId) } : { posts: [] },
                )
              }
            />
          ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
