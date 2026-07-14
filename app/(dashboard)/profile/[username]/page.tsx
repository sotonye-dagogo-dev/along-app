"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { UserMinus, UserPlus, UserCheck, ThumbsUp, MessageCircle } from "lucide-react"
import { AppAvatar, AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"

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
}

interface PostItem {
  id: string
  title: string
  likes: number
  comments: number
  tags: string[]
  createdAt: string
  user: { userName: string; firstName: string; lastName: string }
}

export default function OtherProfilePage() {
  const params = useParams()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("posts")
  const [isFollowing, setIsFollowing] = useState(false)
  const [mutualCount] = useState(0)

  const userName = params.username as string

  useEffect(() => {
    if (!userName) return
    const load = async () => {
      try {
        const [profileRes, postsRes] = await Promise.all([
          fetch(`/api/users/by-username/${encodeURIComponent(userName)}`),
          fetch("/api/posts?limit=20"),
        ])
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile({
            id: profileData.user.id,
            userName: profileData.user.userName,
            firstName: profileData.user.firstName,
            lastName: profileData.user.lastName,
            avatar: profileData.user.avatar,
            avatarConfig: profileData.user.avatarConfig,
            bio: profileData.user.bio,
            verified: profileData.user.verified,
            rewardPoints: profileData.user.rewardPoints,
            rewardTier: profileData.user.rewardTier,
            postCount: profileData.user._count.posts,
            followerCount: profileData.user._count.followers,
            followingCount: profileData.user._count.following,
            avgValidityScore: profileData.user._count.posts > 0 ? Math.round(profileData.user.rewardPoints / profileData.user._count.posts) : 0,
          })
          setIsFollowing(profileData.isFollowing ?? false)
        }
        if (postsRes.ok) {
          const postsData = await postsRes.json()
          const matchingPosts = (postsData.posts ?? []).filter(
            (p: PostItem) => p.user.userName === userName
          )
          setPosts(matchingPosts)
        }
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    load()
  }, [userName])

  const handleFollow = async () => {
    if (!profile) return
    const method = isFollowing ? "DELETE" : "POST"
    try {
      const res = await fetch(`/api/users/${profile.id}/follow`, { method })
      if (res.ok) {
        setIsFollowing(!isFollowing)
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followerCount: prev.followerCount + (isFollowing ? -1 : 1),
              }
            : prev
        )
      }
    } catch { /* ignore */ }
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

  const initials = profile.firstName[0] + (profile.lastName?.[0] ?? "")

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
          <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-1.5">
            {profile.firstName} {profile.lastName}
            {profile.verified && (
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-primary stroke-primary stroke-[1.5]">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
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

        <div className="flex gap-2 mb-3.5">
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
        </div>

        {isFollowing && mutualCount > 0 && (
          <p className="text-xs text-text-muted mb-3.5">{mutualCount} mutual follows</p>
        )}

        <div className="flex border-b border-border mb-4">
          {["posts", "liked", "routes"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-center border-none bg-transparent text-sm font-medium cursor-pointer font-sans transition-colors duration-fast relative ${
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

        <div className="flex flex-col gap-3 pb-8">
          {posts.length === 0 && activeTab === "posts" && (
            <AppEmptyState {...EMPTY_STATES.feed} />
          )}
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="bg-bg-card border border-border radius-lg p-3.5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-base no-underline block"
            >
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/profile/${profile.userName}`} onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-circle bg-warning flex items-center justify-center text-[10px] font-bold text-warning-text shrink-0 no-underline">
                  {initials}
                </Link>
                <Link href={`/profile/${profile.userName}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-text-primary no-underline hover:underline flex-1">
                  {profile.firstName} {profile.lastName}
                </Link>
                <Link href={`/profile/${profile.userName}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-text-muted ml-auto no-underline hover:underline">@{profile.userName}</Link>
              </div>
              <div className="text-sm font-semibold text-text-primary mb-1.5">{post.title}</div>
              <div className="text-[11px] text-text-muted flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {post.likes}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {post.comments}</span>
                {post.tags.slice(0, 2).map((t) => (
                  <Link key={t} href={`/explore?tag=${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()} className="inline-flex px-1.5 py-0.5 radius-pill text-[10px] font-medium bg-bg-elevated text-text-secondary no-underline hover:bg-primary-muted hover:text-primary">#{t}</Link>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
