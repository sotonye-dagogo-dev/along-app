export interface FaqCategory {
  id: string;
  category: string;
  items: { id: string; question: string; answer: string }[];
}

export const DEFAULT_FAQ_ITEMS: FaqCategory[] = [
  {
    id: "getting-started",
    category: "Getting Started",
    items: [
      {
        id: "what-is-along",
        question: "What is Along?",
        answer:
          "Along is a social travel-intelligence platform that lets users share, verify, and discover transport routes in West Africa. Think of it as crowd-sourced transit info — real-time route updates, fare details, and community-verified travel intelligence.",
      },
      {
        id: "how-to-sign-up",
        question: "How do I sign up?",
        answer:
          "Click the 'Sign Up' button on the login page. You can register with your email address or use Google OAuth. After registering, you'll be able to follow other reporters, share routes, and earn trust badges.",
      },
      {
        id: "is-along-free",
        question: "Is Along free to use?",
        answer:
          "Yes, Along is completely free for all users. We believe travel information should be accessible to everyone.",
      },
    ],
  },
  {
    id: "routes",
    category: "Routes & Posts",
    items: [
      {
        id: "how-to-share-route",
        question: "How do I share a route?",
        answer:
          "Tap the 'Share Route' button from the navigation menu. Add your start and end locations, waypoints, fare details, transport mode, and any relevant photos. The more details you provide, the higher your post's quality score. You can park unfinished work with Save Draft and continue it later — reopening a draft lets you update it in place or save it as a new entry.",
      },
      {
        id: "route-verification",
        question: "How are routes verified?",
        answer:
          "Routes are scored by our ValidityEngine, which considers community feedback (likes/dislikes), route detail, corroboration from other users, and recency. Higher-scoring routes earn TrustBadges (Bronze → Platinum).",
      },
      {
        id: "editing-post",
        question: "Can I edit or delete a post?",
        answer:
          "Yes. Open the menu (⋯) on any of your posts — in the feed, on the post page, or on your profile — and choose Edit, Archive, or Delete. Destructive actions ask for confirmation first and can be undone. Edits may reset the recency component of your post's validity score, and a post's nature (route, request, or response) is always preserved through edits.",
      },
    ],
  },
  {
    id: "maps",
    category: "Maps & Navigation",
    items: [
      {
        id: "map-tracings-pins",
        question: "How do I read the maps — tracings and pins?",
        answer:
          "The green line (tracing) is the route path connecting your stops in order. Numbered dots sit exactly on each stop — dot 1 is your origin, the last dot is your destination, and the numbers in between match the route steps. The pulsing blue dot with a soft halo is your own live location.",
      },
      {
        id: "map-zoom-move-mobile",
        question: "How do I zoom and move the map on mobile?",
        answer:
          "Drag with one finger to move (pan) the map. Pinch with two fingers to zoom in and out, or double-tap to zoom in. On the Explore page you can drag the bottom sheet handle to see more routes, and tap any numbered dot to preview that route. Use the Expand button on a route map for a full-screen view.",
      },
    ],
  },
  {
    id: "offline-pwa",
    category: "Offline & App",
    items: [
      {
        id: "how-offline-works",
        question: "Does Along work offline?",
        answer:
          "Yes. Along is an installable app (PWA) that keeps working when your connection drops — including airplane mode. Recently viewed pages, posts, routes, and map tiles are served from an on-device cache. Cached data is labelled while offline; refresh when back online to stay updated.",
      },
      {
        id: "what-works-offline",
        question: "What can I do while offline?",
        answer:
          "You can revisit cached pages (Home, Explore, Search, FAQ, About, Blog), read previously loaded routes and posts, and browse your cached content. Anything that needs the network — signing in, posting, uploading photos, live search — will tell you you're offline and ask you to try again when reconnected. Non-critical actions you take offline are queued and sync automatically.",
      },
      {
        id: "offline-not-cached-page",
        question: "I opened a page offline and saw the offline screen. What now?",
        answer:
          "That page was never cached on this device. The offline screen lists cached pages you can visit right now (Home feed, Explore, Search, FAQ, About, Blog). Reconnect and open the page once — it will then be cached for next time.",
      },
      {
        id: "install-app",
        question: "How do I install Along on my phone or computer?",
        answer:
          "Open Along in Chrome, Edge, or Safari and use 'Add to Home Screen' (mobile) or the install icon in the address bar (desktop). The installed app opens full-screen, works offline with cached content, and can receive push notifications if you enable them.",
      },
      {
        id: "push-notifications",
        question: "How do push notifications work?",
        answer:
          "Every in-app notification — likes, comments, mentions, follows, route responses, rewards, badges, and moderation updates — is also sent as a push notification when you enable it, mirroring what you'd get by email. You can turn push on or off anytime; enabling needs a connection and your browser's permission. Tapping a notification opens the relevant post or page.",
      },
      {
        id: "staying-signed-in-offline",
        question: "Will I be signed out if my network drops?",
        answer:
          "No. Going offline never signs you out — your session is preserved and restored when connectivity returns. You only need to sign in again if your session genuinely expired.",
      },
    ],
  },
  {
    id: "trust",
    category: "Trust & Rewards",
    items: [
      {
        id: "trust-badges",
        question: "What are TrustBadges?",
        answer:
          "TrustBadges indicate the reliability of a route post. Levels range from Low → Developing → Verified → Trusted. Badges are earned through consistent, detailed, and well-received route sharing.",
      },
      {
        id: "reward-points",
        question: "How do reward points work?",
        answer:
          "You earn points for actions like creating posts, receiving likes, and getting bookmarks. Points determine your reward tier (Bronze, Silver, Gold, Platinum), which unlocks perks and recognition in the community.",
      },
      {
        id: "invite-friends",
        question: "How do I invite friends?",
        answer:
          "Go to the Invite page from your profile menu. You'll find a shareable invite link and code. When someone signs up using your invite, you earn bonus reward points.",
      },
    ],
  },
  {
    id: "privacy",
    category: "Privacy & Safety",
    items: [
      {
        id: "data-protection",
        question: "How is my data protected?",
        answer:
          "We comply with the Nigeria Data Protection Regulation (NDPR). Your personal information is encrypted, never sold to third parties, and you can request data deletion at any time. See our Privacy Policy for details.",
      },
      {
        id: "report-content",
        question: "How do I report inappropriate content?",
        answer:
          "Open the menu (⋯) on the post and choose Report, then pick a reason — the report goes straight to our moderation team and stays anonymous. You can also send extra context through the Contact page or file a platform issue via the Report Bug page. Admins review every report and notify you of the outcome.",
      },
    ],
  },
];
