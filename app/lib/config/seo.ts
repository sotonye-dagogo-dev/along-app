interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
}

export const DEFAULT_META = {
  title: "Along - Navigate Together",
  description:
    "Along is a social travel-intelligence platform for sharing, verifying, and discovering transport routes in West Africa.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://alongng.com",
  siteName: "Along",
  ogImage: "/og-image.png",
  twitterHandle: "@along_app",
};

export const PAGE_META: Record<string, PageMeta> = {
  home: {
    title: "Home",
    description: "Your feed of trusted route information from the community.",
  },
  explore: {
    title: "Explore",
    description: "Discover routes near you on the interactive map.",
  },
  bookmarks: {
    title: "Bookmarks",
    description: "Your saved routes for quick reference.",
  },
  notifications: {
    title: "Notifications",
    description: "Stay updated on route changes and community activity.",
  },
  profile: {
    title: "Profile",
    description: "Your route contributions and community reputation.",
  },
  analytics: {
    title: "Analytics",
    description: "Track your route engagement and community impact.",
  },
  invite: {
    title: "Invite Friends",
    description: "Invite friends to Along and earn rewards.",
  },
  about: {
    title: "About",
    description: "Learn about Along's mission to transform urban transit.",
  },
  contact: {
    title: "Contact",
    description: "Get in touch with the Along team.",
  },
  privacy: {
    title: "Privacy Policy",
    description: "How Along handles your data and privacy.",
  },
  terms: {
    title: "Terms of Service",
    description: "The terms governing your use of Along.",
  },
  admin: {
    title: "Admin",
    description: "Platform administration and moderation.",
  },
  login: {
    title: "Sign In",
    description: "Sign in to your Along account.",
  },
  register: {
    title: "Create Account",
    description: "Join Along and start sharing routes.",
  },
  marketplace: {
    title: "Marketplace",
    description: "Browse route guides and transit resources.",
  },
  faq: {
    title: "FAQ",
    description: "Frequently asked questions about Along.",
  },
  blog: {
    title: "Blog",
    description: "Route tips, platform updates, and community stories.",
  },
};
