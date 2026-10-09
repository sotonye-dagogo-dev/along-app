import { Heart, ThumbsDown, MessageCircle, UserPlus, AtSign, Star, Award, ShieldCheck, Sparkles, ClipboardList, Reply, Route } from "lucide-react";
import type { NotificationTypeConfig } from "@/app/lib/types";

type NotificationType =
  | "LIKE"
  | "DISLIKE"
  | "COMMENT"
  | "FOLLOW"
  | "MENTION"
  | "REWARD"
  | "BADGE"
  | "VERIFIED"
  | "WELCOME"
  | "ROUTE_REQUEST"
  | "ROUTE_RESPONSE"
  | "NEW_ROUTE"
  | "REPORT"
  | "MODERATION"
  | "ACCOUNT_DELETION_REQUESTED"
  | "ACCOUNT_DELETION_CANCELLED"
  | "ACCOUNT_DELETION_COMPLETED";

export const NOTIFICATION_REGISTRY: Record<NotificationType, NotificationTypeConfig> = {
  LIKE: {
    label: "Like",
    icon: Heart,
    color: "#EF4444",
    messageTemplate: "{actor} liked your post",
  },
  DISLIKE: {
    label: "Dislike",
    icon: ThumbsDown,
    color: "#64748B",
    messageTemplate: "{actor} disliked your post",
  },
  COMMENT: {
    label: "Comment",
    icon: MessageCircle,
    color: "#3B82F6",
    messageTemplate: "{actor} commented on your post",
  },
  FOLLOW: {
    label: "Follow",
    icon: UserPlus,
    color: "#10B981",
    messageTemplate: "{actor} started following you",
  },
  MENTION: {
    label: "Mention",
    icon: AtSign,
    color: "#8B5CF6",
    messageTemplate: "{actor} mentioned you in a comment",
  },
  REWARD: {
    label: "Reward",
    icon: Star,
    color: "#F59E0B",
    messageTemplate: "You earned {points} points!",
  },
  BADGE: {
    label: "Badge",
    icon: Award,
    color: "#F59E0B",
    messageTemplate: "You unlocked the {tier} badge!",
  },
  VERIFIED: {
    label: "Verified",
    icon: ShieldCheck,
    color: "#10B981",
    messageTemplate: "Your route has been verified",
  },
  WELCOME: {
    label: "Welcome",
    icon: Sparkles,
    color: "#1677FF",
    messageTemplate: "Welcome to Along, {firstName}!",
  },
  ROUTE_REQUEST: {
    label: "Route request",
    icon: ClipboardList,
    color: "#F97316",
    messageTemplate: "{actor} requested a new route",
  },
  ROUTE_RESPONSE: {
    label: "Route response",
    icon: Reply,
    color: "#10B981",
    messageTemplate: "{actor} responded to your route request",
  },
  NEW_ROUTE: {
    label: "New route",
    icon: Route,
    color: "#00A862",
    messageTemplate: "{actor} shared a new route",
  },
  REPORT: {
    label: "Report",
    icon: ShieldCheck,
    color: "#F59E0B",
    messageTemplate: "{actor} reported a post for review",
  },
  MODERATION: {
    label: "Moderation",
    icon: ShieldCheck,
    color: "#1677FF",
    messageTemplate: "Update on a post you reported",
  },
  ACCOUNT_DELETION_REQUESTED: {
    label: "Deletion requested",
    icon: ShieldCheck,
    color: "#F59E0B",
    messageTemplate: "Account deletion requested — archived for 7 days",
  },
  ACCOUNT_DELETION_CANCELLED: {
    label: "Deletion cancelled",
    icon: ShieldCheck,
    color: "#10B981",
    messageTemplate: "Account deletion request was reversed",
  },
  ACCOUNT_DELETION_COMPLETED: {
    label: "Deletion completed",
    icon: ShieldCheck,
    color: "#64748B",
    messageTemplate: "Account deletion completed",
  },
};

/**
 * Copy templates for system-generated engagement notifications.
 * Kept in config (not in services) so copy changes never touch logic.
 */
export const NOTIFICATION_MESSAGES = {
  /** To the inviter when someone signs up with their code. */
  referralConversion: (newUserName: string) =>
    `@${newUserName} signed up through your referral! Bonus points are on the way — keep inviting.`,
  /** To the earner whenever points land. */
  pointsEarned: (points: number, actionLabel: string) =>
    `You've earned ${points} points for ${actionLabel}!`,
  /** To the earner on tier promotion. */
  tierUp: (oldTier: string, newTier: string) =>
    `You've just moved up from ${oldTier} to ${newTier} — good job, keep earning!`,
} as const;
