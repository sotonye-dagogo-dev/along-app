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
        id: "post-menu-options",
        question: "What options are in the post menu (⋯) and who sees what?",
        answer:
          "Every post card — in the feed, on the post page, in search, in your bookmarks, and on profile tabs — has the same menu (⋯) with the same working actions. Everyone sees Copy link (copies the post URL for sharing). Visitors on someone else's post see Report (anonymous, goes to moderation with a thank-you notification on outcome). The author additionally sees Edit (reopens the matching composer, preserving route/request/response nature), Archive/Unarchive (hides from feeds, explore and search until restored), and Delete (confirmed first, undoable right after). Like, dislike, bookmark, share, and comment work from every surface too — comment opens the comment sheet with an expand-post link.",
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
    id: "route-requests",
    category: "Route Requests",
    items: [
      {
        id: "how-to-request-route",
        question: "How do I request a route?",
        answer:
          "Tap “Request a route” — the Request button in the Home composer (below the icon on small screens, beside it on larger ones) or the “Request?” icon in the Share-a-Route modal header. Describe where you want to go from and to, add any stops you know, pick tags that match (they help the right people find it), and post. Your request appears in feeds with a yellow Route request flag so the community can spot it.",
      },
      {
        id: "how-to-respond-request",
        question: "How do I respond to someone's route request?",
        answer:
          "Open the request and tap “Respond to this request”. The composer opens in response mode with the request attached — your route automatically inherits the request's tags, and the linkage is preserved even if you save a draft mid-way or edit your response later. Post it and the requester gets notified.",
      },
      {
        id: "request-tracking",
        question: "How do I know when my request gets a response?",
        answer:
          "You get an in-app notification (plus push and email where enabled) as soon as someone responds. Responses are listed comment-style on the expanded request view with links straight to each response route, and the request card shows a live count with a “View responses” link.",
      },
      {
        id: "request-vs-route",
        question: "Why does my request show no map, fare, or trust score?",
        answer:
          "A request is not a route — it is a call for routes, so there is nothing to trace, price, or score yet. Maps, navigation guides, fares, and trust scores stay hidden on requests by design; they appear on the response routes the community posts for you.",
      },
      {
        id: "who-sees-request",
        question: "Who sees my route request — do they need to follow me?",
        answer:
          "Everyone — no follow needed. Requests surface in the Home feed, Explore, and search for the whole community, and every member gets an in-app notification (plus push where enabled) when you post one. Where the request carries a location and enough members nearby have shared one, nearby members are notified first (optimistic nearby filtering); otherwise — or when location is unavailable — the notification gracefully falls back to the whole community so nobody is silently skipped. You can also tune what you receive in Notifications → settings (gear icon); everything is on by default. Guests need to sign in before they can request or respond.",
      },
      {
        id: "request-location-filtering",
        question: "Are route-request notifications location-based? Is my location stored?",
        answer:
          "Only partly. When you post a request, the app may attach a one-shot location (your cached fix if permission was already granted, otherwise the request's own start point) that is used only for that one fan-out — it is never saved, logged, or shown to anyone. Recipient proximity is checked server-side against the optional last-known fix members already share for the feed nearby boost (nullable, consent-based, cleared on account deletion); raw coordinates are never exposed. If too few nearby members exist, or no location is available, the request simply goes to the whole community — and filtering is best-effort on installed apps, so every request still appears in feed, Explore, and search.",
      },
      {
        id: "notification-preferences",
        question: "How do I customize which notifications I receive?",
        answer:
          "Open the Notifications page and tap the settings (gear) icon at the top. Switches cover route requests, new routes from people you follow, responses to your requests, likes, dislikes, comments, mentions, follows, rewards, badges, reports, moderation outcomes, and device push. Everything is ON by default — exactly how Along works today — so existing accounts keep receiving everything until they opt out (a missing setting always means on). Turning a switch off only stops delivery to you; it never affects what others receive. In-app notifications, push, and email follow the same preferences where each channel applies.",
      },
    ],
  },
  {
    id: "profile-avatar",
    category: "Profile & Avatar",
    items: [
      {
        id: "avatar-management",
        question: "How do I manage my profile photo / avatar?",
        answer:
          "Tap your avatar photo (or the small camera badge on it) anywhere on your profile to open avatar options — on desktop and mobile alike. Choose View larger to preview it, or Change avatar to open the avatar editor: pick a style first (People styles look like you; Robots and Fun are playful), type any word as the seed (your name, a nickname, or a city — the same word always gives the same avatar), try the one-tap ideas or Surprise me, then tweak the background and save. You can also reach the same editor from the Edit Profile modal via the Change avatar row — profile text editing and avatar editing stay separate, so saving one never clobbers the other.",
      },
      {
        id: "avatar-not-showing",
        question: "My avatar looks stale on old posts. What gives?",
        answer:
          "Posts store the avatar from when they were rendered, but profile tabs and cards always prefer the live avatar from the post row and fall back to your current profile header — so the newest avatar wins. If you still see an old image, pull to refresh or reopen the tab; cached lists refresh within about two minutes.",
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
          "The green line (tracing) is the route path connecting your stops in order. Numbered dots sit exactly on each stop — dot 1 is your origin, the last dot is your destination, and the numbers in between match the route steps. The pulsing blue dot with a soft halo is your own live location. Where traffic data is available, stretches of the line turn yellow for medium traffic or red for heavy traffic — tap the “i” icon on the map for the legend.",
      },
      {
        id: "map-traffic-legend",
        question: "What do the yellow and red stretches on a route mean?",
        answer:
          "They are traffic overlays on the route line: yellow means medium traffic on that stretch, red means heavy traffic, and the base green line means free flow. Tap or hover the “i” icon on any route map (or in live navigation) to see the legend — it also tells you whether the data is live or an estimate based on typical conditions for that time of day. Tap the route line itself to see that stretch's traffic level, time share, and distance.",
      },
      {
        id: "map-traffic-duration",
        question: "Why does a route show a time range, and do the stretches add up?",
        answer:
          "Totals show as a range (e.g. 62–75 min): the lower bound is the free-flow time and the upper bound adds the expected delay from the yellow (medium) and red (heavy) stretches. Every stretch time is split from those same totals, so the stretches always add up to the header — tap any stretch on the map for its share. Without any provider keys, Along shows a keyless estimate from typical rush-hour patterns (morning and evening peaks), clearly labeled as estimated, and upgrades to live Mapbox or TomTom traffic automatically when those optional keys are configured. Traffic is cached on your device and refreshed about every 2 minutes while a map is open (hourly on the server) to stay rate-limit friendly; refresh when back online for the latest picture.",
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
          "You can revisit cached pages (Landing, Home, Explore, Search, Profile, Notifications, FAQ, About, Blog), read previously loaded routes and posts, and browse your cached content. Profile and Notifications show the last version you opened while online. Anything that needs the network — signing in, posting, uploading photos, live search — will tell you you're offline and ask you to try again when reconnected. Non-critical actions you take offline are queued and sync automatically.",
      },
      {
        id: "offline-not-cached-page",
        question: "I opened a page offline and saw the offline screen. What now?",
        answer:
          "That page was never cached on this device. The offline screen lists cached pages you can visit right now (Landing, Home feed, Explore, Search, Profile, Notifications, FAQ, About, Blog). Profile and Notifications appear there once you've opened them while online. Reconnect and open the page once — it will then be cached for next time.",
      },
      {
        id: "install-app",
        question: "How do I install Along on my phone or computer?",
        answer:
          "Open Along in Chrome, Edge, or Safari and look for the small Install notice near the bottom of the screen — it never blocks what you're doing and can be minimized or dismissed. Tapping Install uses your browser's install sheet; on iPhone use Share → Add to Home Screen, then open Along from your home screen. The installed app opens full-screen, works offline with cached content, and can receive push notifications if you enable them.",
      },
      {
        id: "push-notifications",
        question: "How do push notifications work?",
        answer:
          "Every in-app notification — likes, comments, mentions, follows, route responses, rewards, badges, and moderation updates — is also sent as a push notification when you enable it, mirroring what you'd get by email. Signed-in users see a small Enable notice (also on the Notifications page) that can be minimized or dismissed; enabling needs a connection and your browser's permission, and the notice explains exactly what to do if permission was blocked or your device needs the installed app first. You can turn push on or off anytime — including per-type in Notifications → settings (gear icon). Tapping a notification opens the relevant post or page.",
      },
      {
        id: "staying-signed-in-offline",
        question: "Will I be signed out if my network drops?",
        answer:
          "No. Going offline never signs you out — your session is preserved and restored when connectivity returns. You only need to sign in again if your session genuinely expired.",
      },
      {
        id: "app-updates",
        question: "Does the installed app update itself?",
        answer:
          "Yes. Along checks for updates in the background — on every visit and about hourly while the app stays open — and shows a small Update notice when a new version is ready. Tapping Update now applies it with a single refresh; tapping Later snoozes the notice for a day. You never lose your session: signing in again is only needed if your session genuinely expired, and cached pages keep working offline either way. Refresh when back online to stay updated.",
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
          "The About page carries the community reviews carousel — real, moderated reviews from commuters — and the same carousel now also appears on the landing page and the Invite page below the blogs. Every so often you'll also see a small panel inviting you to add your own voice (it links to your profile Reviews tab, or to sign-up for guests).",
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
  "post-menu-options": {
    question: "Wetin dey inside post menu (⋯) and who dey see wetin?",
    answer:
      "Every post card — for feed, for post page, for search, for your bookmarks, and for profile tabs — get di same menu (⋯) with di same working actions. Everybody dey see Copy link (e dey copy post URL make you share). For pesin else post you go see Report (e dey anonymous, e dey go moderation). Di owner go still see Edit (e go reopen di correct composer, route/request/response nature go remain), Archive/Unarchive (e dey hide from feed, explore and search till you restore am), and Delete (we go confam first, you fit undo am after). Like, dislike, bookmark, share and comment dey work from everywhere too — comment dey open comment sheet with expand-post link.",
  },
  "avatar-management": {
    question: "How I go take manage my profile photo / avatar?",
    answer:
      "Tap your avatar photo (or di small camera badge on top am) for anywhere for your profile to open avatar options — for desktop and mobile di same. Choose View larger to preview am, or Change avatar to open avatar editor: pick style first (People styles resemble you; Robots and Fun dey playful), type any word as seed (your name, nickname, or city — di same word go always give di same avatar), try one-tap ideas or Surprise me, den take background set am and save. You fit still reach di same editor from Edit Profile modal via Change avatar row — profile text editing and avatar editing dey separate, so to save one no go touch di oda.",
  },
  "avatar-not-showing": {
    question: "My avatar look old for old posts. Wetin happen?",
    answer:
      "Posts dey store avatar from when dem render am, but profile tabs and cards dey always prefer live avatar from post row and dem dey fall back to your current profile header — so di newest avatar dey win. If you still dey see old image, pull to refresh or reopen di tab; cached lists dey refresh within about two minutes.",
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
      "Di green line (tracing) na di route path wey dey connect your stops in order. Number dots dey exactly on top each stop — dot 1 na where you start, di last dot na where you dey go, and di numbers for middle dey match di route steps. Di blue dot wey dey pulse with soft halo na your own live location. Where traffic data dey, parts of di line go turn yellow for medium traffic or red for heavy traffic — tap di “i” icon for map make you see wetin dem mean.",
  },
  "map-traffic-legend": {
    question: "Wetin di yellow and red parts for route mean?",
    answer:
      "Na traffic overlay for di route line: yellow mean medium traffic for dat stretch, red mean heavy traffic, and di green line mean road free. Tap or hover di “i” icon for any route map (or inside live navigation) make you see di legend — e go still tell you whether na live data or estimate from how road take dey be for dat time of day. Tap di route line itsef make you see dat stretch traffic level, time share, and distance.",
  },
  "map-traffic-duration": {
    question: "Why route take show time range, and stretches go add up?",
    answer:
      "Totals dey show as range (e.g. 62–75 min): di lower one na free-road time and di upper one don add delay from yellow (medium) and red (heavy) stretches. Every stretch time dem split am from those same totals, so stretches go always add up reach header — tap any stretch for map make you see im own share. Without provider keys, Along dey show keyless estimate from how rush-hour take dey be (morning and evening peak) — we go label am as estimate — and e go upgrade to live Mapbox or TomTom traffic by itsef when dem configure di optional keys. Traffic dey cached for your device and e dey refresh about every 2 minutes while map dey open (hourly for server) so we no go abuse rate limit; refresh when you come back online make you get di latest.",
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
      "You fit revisit cached pages (Landing, Home, Explore, Search, Profile, Notifications, FAQ, About, Blog), read routes and posts wey don load before, and browse your cached content. Profile and Notifications go show di last version wey you open while online. Anything wey need network — sign in, posting, uploading photos, live search — go tell you say you dey offline and make you try again when you don reconnect. Small-small actions wey you do offline dey queue and go sync by demsef.",
  },
  "offline-not-cached-page": {
    question: "I open page offline come see offline screen. Wetin next?",
    answer:
      "Dat page never enter cache for dis device. Di offline screen dey list cached pages wey you fit visit now-now (Landing, Home feed, Explore, Search, Profile, Notifications, FAQ, About, Blog). Profile and Notifications go show afta you don open dem once while online. Reconnect come open di page once — e go come dey cached for next time.",
  },
  "install-app": {
    question: "How I go take install Along for my phone or computer?",
    answer:
      "Open Along for Chrome, Edge, or Safari come look for small Install notice near di bottom of screen — e no dey block wetin you dey do and you fit reduce am or comot am. Tap Install to use your browser install sheet; for iPhone use Share → Add to Home Screen, den open Along from your home screen. Di installed app dey open full-screen, dey work offline with cached content, and fit send you push notifications if you gree.",
  },
  "push-notifications": {
    question: "How push notifications take dey work?",
    answer:
      "Every in-app notification — likes, comments, mentions, follows, route responses, rewards, badges, and moderation updates — dem still dey send am as push notification when you don on am, just like email own. Signed-in users dey see small Enable notice (also for Notifications page) wey you fit reduce or comot; to on am you need connection and your browser permission, and di notice go explain wetin to do if permission block or your device need di installed app first. You fit on or off am anytime. If you tap notification e go open di correct post or page.",
  },
  "staying-signed-in-offline": {
    question: "Network cut go sign me out?",
    answer:
      "No. To dey offline no dey ever sign you out — your session dey preserved and e go restore when connectivity return. Na only when your session don truly expire you go need sign in again.",
  },
  "app-updates": {
    question: "Di installed app dey update by itsef?",
    answer:
      "Yes. Along dey check for updates for background — every visit and about every hour while app dey open — come show small Update notice when new version don ready. Tap Update now to apply am with one refresh; tap Later to snooze am till tomorrow. Your session no dey loss: na only when your session don truly expire you go need sign in again, and cached pages still dey work offline either way. Refresh when you come back online make you current.",
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
  "how-to-request-route": {
    question: "How I go take request route?",
    answer:
      "Tap “Request a route” — di Request button for Home composer (below icon for small screens, beside am for bigger ones) or di “Request?” icon for Share-a-Route modal header. Describe where you wan start and where you wan go, add any stops wey you know, pick tags wey match (e go help di right people find am), come post. Your request go show for feeds with yellow Route request flag so community fit spot am.",
  },
  "how-to-respond-request": {
    question: "How I go take answer pesin route request?",
    answer:
      "Open di request come tap “Respond to this request”. Di composer go open for response mode with di request attached — your route go automatically carry di request tags, and di linkage go remain even if you save draft for middle or edit your response later. Post am and di pesin wey request go get notified.",
  },
  "request-tracking": {
    question: "How I go take know when my request get answer?",
    answer:
      "You go get in-app notification (plus push and email where you don on am) once pesin respond. Responses dey listed like comments for di expanded request view with links straight to each response route, and di request card dey show live count with “View responses” link.",
  },
  "request-vs-route": {
    question: "Why my request no show map, fare, or trust score?",
    answer:
      "Request no be route — na call for routes, so nothing dey to trace, price, or score yet. Maps, navigation guides, fares, and trust scores dey hidden for requests on purpose; dem go appear for di response routes wey community post for you.",
  },
  "who-sees-request": {
    question: "Who dey see my route request — dem must follow me?",
    answer:
      "Everybody — no need to follow. Requests dey show for Home feed, Explore, and search for di whole community, and every member go get in-app notification (plus push where dem on am) when you post one. Where di request carry location and enough members nearby don share dia own, nearby members go get am first (optimistic nearby filtering); otherwise — or when location no dey — notification go fall back to di whole community so nobody go miss am. You fit still tune wetin you dey receive for Notifications → settings (gear icon); everything dey on by default. Guests must sign in before dem fit request or respond.",
  },
  "request-location-filtering": {
    question: "Route-request notifications dey based on location? Una dey store my location?",
    answer:
      "Small. When you post request, app fit attach one-shot location (your cached fix if you don already grant permission, otherwise di request own start point) wey dem go use only for dat one fan-out — dem no dey save am, log am, or show am to anybody. Dem dey check proximity for server against di optional last-known fix wey members don already share for feed boost (e fit empty, na based on consent, dem dey clear am on account deletion); raw coordinates no dey ever show. If nearby members no reach, or location no dey, request go simply go whole community — and filtering na best-effort for installed apps, so every request still dey show for feed, Explore, and search.",
  },
  "notification-preferences": {
    question: "How I go take choose which notifications I dey receive?",
    answer:
      "Open Notifications page come tap di settings (gear) icon for top. Switches dey cover route requests, new routes from people you dey follow, responses to your requests, likes, dislikes, comments, mentions, follows, rewards, badges, reports, moderation outcomes, and device push. Everything dey ON by default — exactly how Along dey work today — so old accounts go keep receiving everything until dem opt out (setting wey miss mean on). To off switch na only to stop delivery to you; e no dey affect wetin odas dey receive. In-app notifications, push, and email dey follow di same preferences where each channel apply.",
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
      "About page dey carry community reviews carousel — real, moderated reviews from commuters — and di same carousel dey also for landing page and Invite page below blogs. Once-once you go still see small panel wey dey invite you make you add your own voice (e dey link to your profile Reviews tab, or to sign-up for guests).",
  },
};
