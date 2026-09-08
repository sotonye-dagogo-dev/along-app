"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Camera, ThumbsUp, MessageCircle, Bell, BarChart3, UserPlus } from "lucide-react"
import { AppAvatar, AppButton, AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import dynamic from "next/dynamic"
import { RewardsPanel, EditProfileModal } from "@/app/components/features/profile"
import { AuthLinkPanel } from "@/app/components/features/profile/AuthLinkPanel"
import { toastService } from "@/app/lib/services/toastService"

const AvatarEditor = dynamic(() => import("@/app/components/features/profile/AvatarEditor").then((m) => m.AvatarEditor), { ssr: false })
import { useAuth } from "@/app/hooks/useAuth"

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
  likes: number
  comments: number
  tags: string[]
  createdAt: string
  user: { userName: string; firstName: string; lastName: string }
}

export default function OwnProfilePage() {
  const { user: authUser } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("posts")
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAvatarEditor, setShowAvatarEditor] = useState(false)

  useEffect(() => {
    if (!authUser?.id) return
    const abort = new AbortController()
    const load = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch(`/api/users/${authUser.id}`, { signal: abort.signal }),
          fetch("/api/rewards/history", { signal: abort.signal }),
        ])
        if (!profileRes.ok) throw new Error("Failed to load profile")
        const profileData = await profileRes.json()
        if (!abort.signal.aborted) setProfile(profileData.user)
        if (historyRes.ok && !abort.signal.aborted) {
          const historyData = await historyRes.json()
          setRewardHistory(historyData.history ?? [])
        }
      } catch (err: unknown) {
        if (abort.signal.aborted) return
        console.error("Failed to load profile")
      } finally {
        if (!abort.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => abort.abort()
  }, [authUser?.id])

  useEffect(() => {
    if (!profile) return
    const abort = new AbortController()
    const loadPosts = async () => {
      try {
        const res = await fetch("/api/posts?limit=20", { signal: abort.signal })
        if (!res.ok) throw new Error("Failed to load posts")
        const data = await res.json()
        if (!abort.signal.aborted) setPosts(data.posts ?? [])
      } catch (err: unknown) {
        if (abort.signal.aborted) return
        console.error("Failed to load posts")
      }
    }
    loadPosts()
    return () => abort.abort()
  }, [profile])

  const loadProfile = useCallback(async () => {
    if (!authUser?.id) return
    try {
      const res = await fetch(`/api/users/${authUser.id}`)
      const data = await res.json()
      setProfile(data.user)
    } catch { /* ignore */ }
  }, [authUser?.id])

  const handleEditProfile = async (data: Record<string, unknown>) => {
    if (!authUser?.id) return
    try {
      await fetch(`/api/users/${authUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      toastService.success("Profile updated!")
      await loadProfile()
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
      await loadProfile()
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
          {["posts", "liked", "bookmarks", "routes"].map((tab) => (
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
                <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-circle bg-primary-muted flex items-center justify-center text-[10px] font-bold text-primary shrink-0 no-underline">
                  {post.user.firstName[0]}{post.user.lastName[0]}
                </Link>
                <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-text-primary no-underline hover:underline flex-1">
                  {post.user.firstName} {post.user.lastName}
                </Link>
                <Link href={`/profile/${post.user.userName}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-text-muted ml-auto no-underline hover:underline">@{post.user.userName}</Link>
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

      <EditProfileModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialValues={{
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
