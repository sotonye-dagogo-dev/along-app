import type { LucideIcon } from "lucide-react";

export type VehicleType = "taxi" | "bike" | "keke" | "bus" | "trekking" | "car" | "bolt";

export interface VehicleConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgClass: string;
  textClass: string;
}

export type RouteStatus = "on-time" | "delayed" | "cancelled" | "diverted" | "unknown";

export interface RouteStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  activeIcon?: LucideIcon;
  roles?: ("user" | "admin" | "USER" | "ADMIN")[];
  section?: "main" | "admin";
}

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "textarea" | "select" | "file" | "number" | "tel";
  placeholder?: string;
  required?: boolean;
  validation?: Record<string, unknown>;
  options?: { label: string; value: string }[];
  icon?: LucideIcon;
}

export interface NotificationTypeConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  messageTemplate: string;
}

export interface FeedAlgorithmConfig {
  followingWeight: number;
  matchingTagsWeight: number;
  trendingWeight: number;
  locationBonus: number;
  cacheTtlSeconds: number;
  pageSize: number;
}

export interface QualityCheckpoint {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  weight: number;
  validate: (draft: Record<string, unknown>) => boolean;
}

export interface ValidityConfig {
  likeRatioWeight: number;
  detailScoreWeight: number;
  similarityRatioWeight: number;
  recencyWeight: number;
  minScoreForVerified: number;
  minScoreForTrusted: number;
  cacheTtlSeconds: number;
}

export interface AvatarConfig {
  style: string;
  seed?: string;
  flip?: boolean;
  backgroundColor?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar?: string;
  socials?: { platform: string; url: string }[];
}

export interface TransportIntegrationConfig {
  provider: string;
  label: string;
  icon: LucideIcon;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
}

export interface PointsAction {
  action: string;
  points: number;
  cooldownHours?: number;
  maxPerDay?: number;
}

export interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}
