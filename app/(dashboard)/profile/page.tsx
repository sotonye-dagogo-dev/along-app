"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Camera, Bell, BarChart3, UserPlus } from "lucide-react"
import { AppAvatar, AppButton, AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import dynamic from "next/dynamic"
import { RewardsPanel, EditProfileModal } from "@/app/components/features/profile"
import { ProfilePostCard } from "@/app/components/features/profile/ProfilePostCard"
import { AuthLinkPanel } from "@/app/components/features/profile/AuthLinkPanel"
import { toastService } from "@/app/lib/services/toastService"

const AvatarEditor = dynamic(() => import("@/app/components/features/profile/AvatarEditor").then((m) => m.AvatarEditor), { ssr: false })
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"

interface RewardHistoryItem {
  id: string
  action: string
  points: number
  createdAt: Date
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
  isArchived?: boolean
  user: { id?: string; userName: string; firstName: string; lastName: string }
}

// Profile content tabs: "routes" lists actual routes (ROUTE + ROUTE_RESPONSE),
// "requests" lists route requests, "archived" is the owner's private library.
const PROFILE_TABS = ["posts", "routes", "requests", "liked", "bookmarks", "archived"] as const
type ProfileTab = (typeof PROFILE_TABS)[number]

export default function OwnProfilePage() {
  const { user: authUser, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts")
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAvatarEditor, setShowAvatarEditor] = useState(false)

  const ready = !authLoading && Boolean(authUser?.id)
  const userId = (authUser?.id as string) ?? ""

  const { data: profileRes, loading: profileLoading, mutate: mutateProfile } = useCachedFetch<{ user: ProfileData }>(
    ready ? `me-profile:${userId}` : null,
    `/api/users/${userId}`,
    { ttlSec: 120, enabled: ready }
  )
  const { data: historyRes, loading: historyLoading } = useCachedFetch<{ history: RewardHistoryItem[] }>(
    ready ? `rewards-history:${userId}` : null,
    "/api/rewards/history",
    { ttlSec: 300, enabled: ready }
  )
  // Per-tab post lists (posts / routes / requests / liked / bookmarks / archived)
  const tabQuery =
    activeTab === "bookmarks"
      ? "/api/bookmarks?limit=20"
      : activeTab === "liked"
        ? `/api/posts?limit=20&likedBy=${userId}`
        : activeTab === "routes"
          ? `/api/posts?limit=20&userId=${userId}&type=ROUTE,ROUTE_RESPONSE`
          : activeTab === "requests"
            ? `/api/posts?limit=20&userId=${userId}&type=ROUTE_REQUEST`
            : activeTab === "archived"
              ? `/api/posts?limit=20&userId=${userId}&archived=true`
              : `/api/posts?limit=20&userId=${userId}`
  const { data: postsData, loading: postsLoading, mutate: mutatePosts } = useCachedFetch<{ posts: PostItem[] }>(
    ready ? `profile-tab:${userId}:${activeTab}` : null,
    tabQuery,
    { ttlSec: 120, enabled: ready }
  )

  const profile = profileRes?.user ?? null
  const rewardHistory = historyRes?.history ?? []
  const posts = postsData?.posts ?? []
  const loading = authLoading || profileLoading || historyLoading

  const refreshProfile = async () => {
    try {
      const res = await fetch(`/api/users/${userId}`)
      if (res.ok) {
        const data = await res.json()
        mutateProfile(data)
      }
    } catch { /* ignore */ }
  }

  const handleEditProfile = async (data: Record<string, unknown>) => {
    if (!authUser?.id) return
    try {
      const res = await fetch(`/api/users/${authUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        toastService.error(err?.error ?? "Failed to update profile")
        return
      }
      toastService.success("Profile updated!")
      await refreshProfile()
    } catch {
      toastService.error("Failed to update profile")
    }
  }

  const handleSaveAvatar = async (avatarConfig: { style: string; seed?: string; flip?: boolean; backgroundColor?: string }) => {
    if (!authUser?.id) return
    try {
      await fetch(`/api/users/${authUser.id}/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarConfig }),
      })
      toastService.success("Avatar saved!")
      await refreshProfile()
    } catch {
      toastService.error("Failed to save avatar")
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

  return (
    <div className="max-w-[680px] mx-auto px-4 py-4">
      <div className="h-[180px] bg-gradient-to-br from-primary-dark to-primary radius-lg mb-0 relative" />

      <div className="relative px-5">
        <div className="flex items-end gap-4 -mt-10 mb-3">
          <div className="relative">
            <AppAvatar
              src={profile.avatar ?? undefined}
              alt={`${profile.firstName} ${profile.lastName}`}
              size={80}
              config={profile.avatarConfig ?? undefined}
              verified={profile.verified}
              linkToProfile={false}
              className="border-3 border-bg-base"
            />
            <button
              onClick={() => setShowAvatarEditor(true)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-circle bg-bg-card border-2 border-bg-base flex items-center justify-center cursor-pointer text-text-secondary hover:text-primary transition-colors duration-fast"
              aria-label="Edit avatar"
            >
              <Camera size={13} />
            </button>
          </div>
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
            <React.Fragment key={s.label}>
              <div className="flex-1 text-center">
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
              </div>
              {i < arr.length - 1 && <div className="w-px h-8 bg-border shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex gap-2 mb-3.5">
          <AppButton variant="secondary" onClick={() => setShowEditModal(true)} className="flex-1">
            Edit Profile
          </AppButton>
        </div>

        <AuthLinkPanel />

        <RewardsPanel
          tier={profile.rewardTier}
          points={profile.rewardPoints}
          history={rewardHistory}
        />

        {/* Mobile-only quick links for sidebar items not on bottom tab bar */}
        <div className="lg:hidden flex flex-col gap-0.5 mb-4 py-3 border-t border-border">
          <div className="text-[11px] font-medium tracking-wider uppercase text-text-muted px-3 mb-1">
            Quick Links
          </div>
          <Link
            href="/notifications"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors no-underline"
          >
            <Bell size={18} className="shrink-0" />
            Notifications
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors no-underline"
          >
            <BarChart3 size={18} className="shrink-0" />
            Analytics
          </Link>
          <Link
            href="/invite"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors no-underline"
          >
            <UserPlus size={18} className="shrink-0" />
            Invite Friends
          </Link>
        </div>

        <div className="flex border-b border-border mb-4">
          {PROFILE_TABS.map((tab) => (
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
                  isArchived: post.isArchived,
                  createdAt: post.createdAt,
                  user: {
                    id: post.user.id ?? userId,
                    userName: post.user.userName,
                    firstName: post.user.firstName,
                    lastName: post.user.lastName,
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
        </div>
      </div>

      <EditProfileModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialValues={{
          userName: profile.userName,
          firstName: profile.firstName,
          lastName: profile.lastName,
          bio: profile.bio ?? "",
        }}
        onSubmit={handleEditProfile}
      />

      <AvatarEditor
        open={showAvatarEditor}
        onClose={() => setShowAvatarEditor(false)}
        currentConfig={profile.avatarConfig ?? undefined}
        userName={profile.userName}
        onSave={handleSaveAvatar}
      />
    </div>
  )
}
