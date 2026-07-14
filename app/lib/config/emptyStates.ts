import {
  Compass, BookmarkX, BellOff, Inbox, SearchX, Users, UserPlus,
  MessageCircle, Heart, MapPin, FileText, WifiOff, AlertTriangle,
} from "lucide-react";
import type { EmptyStateConfig } from "@/app/lib/types";

export const EMPTY_STATES: Record<string, EmptyStateConfig> = {
  feed: {
    icon: Compass,
    title: "No posts yet",
    description: "Follow some users or explore routes to populate your feed.",
    actionLabel: "Explore Routes",
    actionHref: "/explore",
  },
  bookmarks: {
    icon: BookmarkX,
    title: "No bookmarks yet",
    description: "Save routes you find useful by tapping the bookmark icon.",
    actionLabel: "Discover Routes",
    actionHref: "/explore",
  },
  notifications: {
    icon: BellOff,
    title: "No notifications",
    description: "You will see notifications here when someone interacts with your posts.",
  },
  messages: {
    icon: Inbox,
    title: "No messages",
    description: "Start a conversation by reaching out to another traveler.",
  },
  search: {
    icon: SearchX,
    title: "No results found",
    description: "Try adjusting your search terms or filters.",
  },
  followers: {
    icon: Users,
    title: "No followers yet",
    description: "Share quality routes to build your reputation and gain followers.",
  },
  following: {
    icon: UserPlus,
    title: "Not following anyone yet",
    description: "Explore the community and follow users to see their routes in your feed.",
    actionLabel: "Explore",
    actionHref: "/explore",
  },
  comments: {
    icon: MessageCircle,
    title: "No comments yet",
    description: "Be the first to share your thoughts on this route.",
  },
  likes: {
    icon: Heart,
    title: "No likes yet",
    description: "When someone likes your post, it will appear here.",
  },
  routes: {
    icon: MapPin,
    title: "No routes shared yet",
    description: "Share your first route to help the community.",
    actionLabel: "Share a Route",
    actionHref: "/home",
  },
  reviews: {
    icon: FileText,
    title: "No reviews yet",
    description: "Reviews will appear once the community starts sharing feedback.",
  },
  offline: {
    icon: WifiOff,
    title: "You are offline",
    description: "Some features may be unavailable. Cached content is still accessible.",
  },
  error: {
    icon: AlertTriangle,
    title: "Something went wrong",
    description: "Please try again. If the problem persists, contact support.",
    actionLabel: "Try Again",
    actionHref: "/",
  },
};
