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
      {
        id: "share-route-validation",
        question: "Why is the Share button disabled, or why did my route not publish?",
        answer:
          "The Share button stays disabled until every route step has a location and every fare is a single valid amount. Each stop needs its own location — empty stops block sharing with a highlighted message instead of being silently dropped. Fares must be one amount per leg (numbers only, e.g. 450); ranges like “400-500” are rejected with guidance to enter one amount per leg. Titles need at least 5 characters, and descriptions are optional but need at least 10 characters when provided. The destination (final stop) needs no fare or vehicle — those fields are hidden there by design. If publishing fails (for example, a network error), the modal stays open, your input and saved draft are preserved, and a message explains what to fix — a post only clears from the composer after it has actually been saved, so it can never silently vanish.",
      },
      {
        id: "share-route-drafts-failure",
        question: "What happens to my draft if sharing fails?",
        answer:
          "Nothing is lost. Your composer input stays exactly as it was and any saved draft is kept, so you can fix the highlighted fields and try again. Drafts are only cleared after the server confirms your post was created — at which point it appears in your feed, on Explore, and in post management.",
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
    id: "reviews",
    category: "Reviews",
    items: [
      {
        id: "how-to-leave-review",
        question: "How do I leave a platform review?",
        answer:
          "Open your profile and switch to the Reviews tab. Pick a star rating (1–5), write a few words about your experience, and hit Submit. You can leave one review — submitting again simply updates it. Guests need to sign in first.",
      },
      {
        id: "how-reviews-moderated",
        question: "What happens after I submit a review?",
        answer:
          "Your review goes into moderation (Pending) and becomes visible on the About page once approved. You'll receive an in-app thank-you notification as soon as it's submitted — no email, just a heads-up inside Along.",
      },
      {
        id: "where-reviews-appear",
        question: "Where can I read other people's reviews?",
        answer:
          "The About page carries the community reviews carousel — real, moderated reviews from commuters. Every so often you'll also see a small panel inviting you to add your own voice.",
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

/**
 * Pidgin overrides for FAQ content, keyed by item id. The client applies
 * these when the active locale is `pcm`; any item/field missing here falls
 * back to the English config above (never a raw key). Keeping translations
 * beside the source copy makes review by non-engineers a single-file job.
 */
export const FAQ_PCM: Record<string, { question?: string; answer?: string }> = {
  "what-is-along": {
    question: "Wetin be Along?",
    answer:
      "Along na social travel-intelligence platform wey allow people share, verify and find transport routes for West Africa. Think am like crowd-sourced transit gist — correct route updates, fare details, and community-verified travel sense.",
  },
  "how-to-sign-up": {
    question: "How I go take sign up?",
    answer:
      "Tap di 'Sign Up' button for login page. You fit register with your email or use Google OAuth. After you don register, you go fit follow oda reporters, share routes, and earn trust badges.",
  },
  "is-along-free": {
    question: "Along free to use?",
    answer:
      "Yes, Along free kpata-kpata for everybody. We believe say travel information suppose dey accessible to all.",
  },
  "how-to-share-route": {
    question: "How I go take share route?",
    answer:
      "Tap di 'Share Route' button from navigation menu. Add where you dey start and where you dey go, stops for middle, fare details, transport mode, and any correct photos. Di more details you drop, di higher your post quality score. You fit park work wey never finish with Save Draft come continue am later — if you reopen draft you fit update am there or save am as new entry.",
  },
  "route-verification": {
    question: "How dem take dey verify routes?",
    answer:
      "Our ValidityEngine dey score routes with community feedback (likes/dislikes), route detail, confam from oda users, and how fresh e be. Routes wey score high dey earn TrustBadges (Bronze → Platinum).",
  },
  "editing-post": {
    question: "I fit edit or delete post?",
    answer:
      "Yes. Open di menu (⋯) for any of your posts — for feed, for post page, or for your profile — come choose Edit, Archive, or Delete. For di ones wey dey pain body we go first ask you to confam and you fit undo am. Edit fit reset di recency part of your validity score, and di nature of post (route, request, or response) must remain di same even after edits.",
  },
  "share-route-validation": {
    question: "Why Share button take lock, or why my route no publish?",
    answer:
      "Di Share button go remain lock until every route step get location and every fare na single correct amount. Each stop need im own location — empty stop go block sharing with highlighted message instead of to just waka comot. Fare must be one amount per leg (numbers only, e.g. 450); range like “400-500” no dey supported — enter one amount per leg. Title need at least 5 characters, and description na optional but e need at least 10 characters if you put am. Di destination (last stop) no need fare or vehicle — we hide dem there on purpose. If to publish fail (e.g. network wahala), di modal go remain open, your input and saved draft go dey kampe, and message go explain wetin to fix — post go only clear from composer after e don truly save, so e no fit take style vanish.",
  },
  "share-route-drafts-failure": {
    question: "Wetin go happen to my draft if sharing fail?",
    answer:
      "Nothing go loss. Your composer input go remain as e be and any saved draft go dey, so you fit fix di highlighted fields come try again. Drafts dey only clear after server confam say your post don enter — dat time e go show for your feed, for Explore, and for post management.",
  },
  "map-tracings-pins": {
    question: "How I go take read di maps — tracings and pins?",
    answer:
      "Di green line (tracing) na di route path wey dey connect your stops in order. Number dots dey exactly on top each stop — dot 1 na where you start, di last dot na where you dey go, and di numbers for middle dey match di route steps. Di blue dot wey dey pulse with soft halo na your own live location.",
  },
  "map-zoom-move-mobile": {
    question: "How I go take zoom and move map for mobile?",
    answer:
      "Drag with one finger make di map move (pan). Pinch with two fingers make you zoom in and out, or double-tap make you zoom in. For Explore page you fit drag di bottom sheet handle make you see more routes, and tap any number dot make you preview dat route. Use di Expand button for full-screen view.",
  },
  "how-offline-works": {
    question: "Along dey work offline?",
    answer:
      "Yes. Along na installable app (PWA) wey dey keep working even when connection cut — including airplane mode. Pages, posts, routes and map tiles wey you don view before dey served from on-device cache. We dey label cached data while offline; refresh when you come back online make you current.",
  },
  "what-works-offline": {
    question: "Wetin I fit do while offline?",
    answer:
      "You fit revisit cached pages (Home, Explore, Search, FAQ, About, Blog), read routes and posts wey don load before, and browse your cached content. Anything wey need network — sign in, posting, uploading photos, live search — go tell you say you dey offline and make you try again when you don reconnect. Small-small actions wey you do offline dey queue and go sync by demsef.",
  },
  "offline-not-cached-page": {
    question: "I open page offline come see offline screen. Wetin next?",
    answer:
      "Dat page never enter cache for dis device. Di offline screen dey list cached pages wey you fit visit now-now (Home feed, Explore, Search, FAQ, About, Blog). Reconnect come open di page once — e go come dey cached for next time.",
  },
  "install-app": {
    question: "How I go take install Along for my phone or computer?",
    answer:
      "Open Along for Chrome, Edge, or Safari come use 'Add to Home Screen' (mobile) or di install icon for address bar (desktop). Di installed app dey open full-screen, dey work offline with cached content, and fit send you push notifications if you gree.",
  },
  "push-notifications": {
    question: "How push notifications take dey work?",
    answer:
      "Every in-app notification — likes, comments, mentions, follows, route responses, rewards, badges, and moderation updates — dem still dey send am as push notification when you don on am, just like email own. You fit on or off am anytime; to on am you need connection and your browser permission. If you tap notification e go open di correct post or page.",
  },
  "staying-signed-in-offline": {
    question: "Network cut go sign me out?",
    answer:
      "No. To dey offline no dey ever sign you out — your session dey preserved and e go restore when connectivity return. Na only when your session don truly expire you go need sign in again.",
  },
  "trust-badges": {
    question: "Wetin be TrustBadges?",
    answer:
      "TrustBadges dey show how reliable route post be. Levels dey from Low → Developing → Verified → Trusted. Na consistent, detailed, and correct route sharing dey earn dem.",
  },
  "reward-points": {
    question: "How reward points take dey work?",
    answer:
      "You dey earn points for things like creating posts, receiving likes, and getting bookmarks. Points dey decide your reward tier (Bronze, Silver, Gold, Platinum), wey dey unlock perks and recognition for community.",
  },
  "invite-friends": {
    question: "How I go take invite friends?",
    answer:
      "Go Invite page from your profile menu. You go see shareable invite link and code. When pesin sign up with your invite, you go earn bonus reward points.",
  },
  "data-protection": {
    question: "How una take dey protect my data?",
    answer:
      "We dey follow Nigeria Data Protection Regulation (NDPR). Your personal information dey encrypted, we no dey sell am to third parties, and you fit request data deletion anytime. Check our Privacy Policy for details.",
  },
  "report-content": {
    question: "How I go take report bad content?",
    answer:
      "Open di menu (⋯) for di post come choose Report, den pick reason — di report dey go straight to our moderation team and e go remain anonymous. You fit still send extra gist through Contact page or file platform issue via Report Bug page. Admins dey review every report and dem go notify you of di outcome.",
  },
  "how-to-leave-review": {
    question: "How I go take drop platform review?",
    answer:
      "Open your profile come switch to Reviews tab. Pick star rating (1–5), write small tori about your experience, come hit Submit. You fit drop one review — if you send again e go just update am. Guests suppose sign in first.",
  },
  "how-reviews-moderated": {
    question: "Wetin go happen after I submit review?",
    answer:
      "Your review go enter moderation (Pending) and e go show for About page once we approve am. You go receive in-app tank-you notification once e don enter — no email, just heads-up inside Along.",
  },
  "where-reviews-appear": {
    question: "Where I fit read oda people reviews?",
    answer:
      "About page dey carry community reviews carousel — real, moderated reviews from commuters. Once-once you go still see small panel wey dey invite you make you add your own voice.",
  },
};
