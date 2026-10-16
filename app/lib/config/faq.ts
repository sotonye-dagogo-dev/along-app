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
          "Every post has the same menu (⋯) wherever you see it. Everyone gets Copy link to share and Report to flag a post for moderation (anonymous). On your own posts you additionally get Edit, Archive, and Delete. Likes, bookmarks, shares, and comments work from every view too.",
      },
      {
        id: "share-route-validation",
        question: "Why is the Share button disabled, or why did my route not publish?",
        answer:
          "The Share button stays disabled until each stop has a location and each fare is a single amount (numbers only, e.g. 450 — ranges like “400-500” aren't accepted). Titles need at least 5 characters. The final destination needs no fare or vehicle. If publishing fails, the modal stays open with your work intact and a note on what to fix.",
      },
      {
        id: "share-route-drafts-failure",
        question: "What happens to my draft if sharing fails?",
        answer:
          "Nothing is lost. Your input and any saved draft stay in place so you can fix the highlighted fields and try again. Drafts clear only after your post is confirmed published.",
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
          "Tap “Request a route”, describe where you're going from and to, add any stops you know and matching tags, then post. Your request appears in feeds with a Route request flag so the community can respond.",
      },
      {
        id: "how-to-respond-request",
        question: "How do I respond to someone's route request?",
        answer:
          "Open the request and tap “Respond to this request”. The composer opens with the request attached and your route picks up its tags automatically. Post it and the requester is notified.",
      },
      {
        id: "request-tracking",
        question: "How do I know when my request gets a response?",
        answer:
          "You'll be notified as soon as someone responds. Responses are listed on the request with links to each response route.",
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
          "Everyone — no follow needed. Requests appear in the Home feed, Explore, and search, and members are notified when you post one. People nearby may be notified first where location is available. You can tune what you receive in Notifications settings; guests need to sign in to request or respond.",
      },
      {
        id: "request-location-filtering",
        question: "Is my location shared when I request a route?",
        answer:
          "No. Your location is only used to notify people nearby about your request — it is never shown to anyone else. If location isn't available, your request still reaches the whole community.",
      },
      {
        id: "notification-preferences",
        question: "How do I customize which notifications I receive?",
        answer:
          "Open the Notifications page and tap the settings (gear) icon. Switches cover requests, responses, likes, comments, mentions, follows, and rewards — everything is on by default, so just turn off what you don't want.",
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
          "Tap your avatar photo on your profile to preview it or open the avatar editor. Pick a style, type any word as the seed (the same word always gives the same avatar), try the ideas or Surprise me, then save. The same editor is also available from Edit Profile.",
      },
      {
        id: "avatar-not-showing",
        question: "My avatar looks stale on old posts. What gives?",
        answer:
          "If old posts still show a previous avatar, pull to refresh or reopen the tab — it updates shortly.",
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
          "The green line (tracing) is the route path connecting your stops in order. Numbered dots mark each stop — dot 1 is your origin and the last dot is your destination. The pulsing blue dot is your own live location.",
      },
      {
        id: "map-traffic-legend",
        question: "What do the yellow and red stretches on a route mean?",
        answer:
          "Yellow means medium traffic on that stretch, red means heavy traffic, and green means free flow. Tap the “i” icon on any route map to see the legend.",
      },
      {
        id: "map-traffic-duration",
        question: "Why does a route show a time range?",
        answer:
          "Totals show as a range (e.g. 62–75 min): the lower bound is the free-flow time and the upper bound adds expected traffic delays. Stretch times always add up to the header total — tap any stretch on the map for its share.",
      },
      {
        id: "map-zoom-move-mobile",
        question: "How do I zoom and move the map on mobile?",
        answer:
          "Drag with one finger to move the map. Pinch with two fingers to zoom in and out, or double-tap to zoom in. Tap any numbered dot to preview that route, or use Expand for a full-screen view.",
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
          "Yes. Pages, posts, routes, and maps you've already viewed stay available when your connection drops — including airplane mode. Cached content is labelled while offline; refresh when back online to stay updated.",
      },
      {
        id: "what-works-offline",
        question: "What can I do while offline?",
        answer:
          "You can revisit pages you've already opened and read loaded routes and posts. Anything needing the network — signing in, posting, uploads, live search — will ask you to try again when reconnected.",
      },
      {
        id: "offline-not-cached-page",
        question: "I opened a page offline and saw the offline screen. What now?",
        answer:
          "That page wasn't opened while you were online, so it isn't available offline. The offline screen lists pages you can visit now — reconnect and open the page once to make it available next time.",
      },
      {
        id: "install-app",
        question: "How do I install Along on my phone or computer?",
        answer:
          "Open Along in your browser and tap Install when offered; on iPhone use Share → Add to Home Screen. The installed app opens full-screen and works offline with your viewed pages.",
      },
      {
        id: "push-notifications",
        question: "How do push notifications work?",
        answer:
          "Turn on push to get alerts for likes, comments, mentions, follows, responses, and rewards. You can switch it on or off anytime, including per-type in Notifications settings. Tapping a notification opens the related post or page.",
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
          "Yes. When a new version is ready you'll see a small Update notice — tap Update to apply it with a refresh, or Later to snooze it. Your session is kept, so you stay signed in.",
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
          "The About page shows community reviews, also shown on the landing and Invite pages. You'll occasionally see an invite to add your own.",
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
      "Every post get di same menu (⋯) anywhere you see am. Everybody get Copy link to share and Report to flag post for moderation (anonymous). For your own posts you go still see Edit, Archive, and Delete. Like, bookmark, share and comment dey work from everywhere too.",
  },
  "avatar-management": {
    question: "How I go take manage my profile photo / avatar?",
    answer:
      "Tap your avatar photo for your profile to preview am or open avatar editor. Pick style, type any word as seed (di same word go always give di same avatar), try di ideas or Surprise me, den save. Di same editor dey also for Edit Profile.",
  },
  "avatar-not-showing": {
    question: "My avatar look old for old posts. Wetin happen?",
    answer:
      "If old posts still dey show former avatar, pull to refresh or reopen di tab — e go update shortly.",
  },
  "share-route-validation": {
    question: "Why Share button take lock, or why my route no publish?",
    answer:
      "Di Share button go remain lock until every stop get location and every fare na single amount (numbers only, e.g. 450 — range like “400-500” no dey accepted). Title need at least 5 characters. Di last stop no need fare or vehicle. If to publish fail, di modal go remain open with your work kampe and note on wetin to fix.",
  },
  "share-route-drafts-failure": {
    question: "Wetin go happen to my draft if sharing fail?",
    answer:
      "Nothing go loss. Your input and any saved draft go remain so you fit fix di highlighted fields come try again. Drafts dey only clear after your post don confam to publish.",
  },
  "map-tracings-pins": {
    question: "How I go take read di maps — tracings and pins?",
    answer:
      "Di green line (tracing) na di route path wey dey connect your stops in order. Number dots dey mark each stop — dot 1 na where you start and di last dot na where you dey go. Di blue dot wey dey pulse na your own live location.",
  },
  "map-traffic-legend": {
    question: "Wetin di yellow and red parts for route mean?",
    answer:
      "Yellow mean medium traffic for dat stretch, red mean heavy traffic, and green mean road free. Tap di “i” icon for any route map make you see wetin dem mean.",
  },
  "map-traffic-duration": {
    question: "Why route take show time range?",
    answer:
      "Totals dey show as range (e.g. 62–75 min): di lower one na free-road time and di upper one don add traffic delay. Stretch times go always add up reach header total — tap any stretch for map make you see im own share.",
  },
  "map-zoom-move-mobile": {
    question: "How I go take zoom and move map for mobile?",
    answer:
      "Drag with one finger make di map move. Pinch with two fingers make you zoom in and out, or double-tap make you zoom in. Tap any number dot make you preview dat route, or use Expand for full-screen view.",
  },
  "how-offline-works": {
    question: "Along dey work offline?",
    answer:
      "Yes. Pages, posts, routes and maps wey you don view before dey remain available when connection cut — including airplane mode. We dey label cached data while offline; refresh when you come back online make you current.",
  },
  "what-works-offline": {
    question: "Wetin I fit do while offline?",
    answer:
      "You fit revisit pages wey you don open before and read routes and posts wey don load. Anything wey need network — sign in, posting, uploads, live search — go ask you make you try again when you don reconnect.",
  },
  "offline-not-cached-page": {
    question: "I open page offline come see offline screen. Wetin next?",
    answer:
      "Dat page you no open am while you dey online, so e no dey available offline. Di offline screen dey list pages wey you fit visit now — reconnect come open di page once make e dey available next time.",
  },
  "install-app": {
    question: "How I go take install Along for my phone or computer?",
    answer:
      "Open Along for your browser come tap Install when e show; for iPhone use Share → Add to Home Screen. Di installed app dey open full-screen and dey work offline with pages wey you don view.",
  },
  "push-notifications": {
    question: "How push notifications take dey work?",
    answer:
      "On push make you dey get alerts for likes, comments, mentions, follows, responses, and rewards. You fit on or off am anytime, including per-type for Notifications settings. If you tap notification e go open di correct post or page.",
  },
  "staying-signed-in-offline": {
    question: "Network cut go sign me out?",
    answer:
      "No. To dey offline no dey ever sign you out — your session dey preserved and e go restore when connectivity return. Na only when your session don truly expire you go need sign in again.",
  },
  "app-updates": {
    question: "Di installed app dey update by itsef?",
    answer:
      "Yes. When new version don ready you go see small Update notice — tap Update to apply am with refresh, or Later to snooze am. Your session dey kampe, so you go remain signed in.",
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
      "Tap “Request a route”, describe where you wan start and where you wan go, add any stops wey you know and tags wey match, come post. Your request go show for feeds with Route request flag so community fit respond.",
  },
  "how-to-respond-request": {
    question: "How I go take answer pesin route request?",
    answer:
      "Open di request come tap “Respond to this request”. Di composer go open with di request attached and your route go carry di request tags by itsef. Post am and di pesin wey request go get notified.",
  },
  "request-tracking": {
    question: "How I go take know when my request get answer?",
    answer:
      "You go get notified once pesin respond. Responses dey listed for di request with links to each response route.",
  },
  "request-vs-route": {
    question: "Why my request no show map, fare, or trust score?",
    answer:
      "Request no be route — na call for routes, so nothing dey to trace, price, or score yet. Maps, navigation guides, fares, and trust scores dey hidden for requests on purpose; dem go appear for di response routes wey community post for you.",
  },
  "who-sees-request": {
    question: "Who dey see my route request — dem must follow me?",
    answer:
      "Everybody — no need to follow. Requests dey show for Home feed, Explore, and search, and members dey get notified when you post one. People nearby fit get notified first where location dey. You fit tune wetin you dey receive for Notifications settings; guests must sign in before dem fit request or respond.",
  },
  "request-location-filtering": {
    question: "My location dey shared when I request route?",
    answer:
      "No. Your location dem dey use am only to notify people nearby about your request — e no dey ever shown to anybody else. If location no dey, your request still dey reach di whole community.",
  },
  "notification-preferences": {
    question: "How I go take choose which notifications I dey receive?",
    answer:
      "Open Notifications page come tap di settings (gear) icon. Switches dey cover requests, responses, likes, comments, mentions, follows, and rewards — everything dey on by default, so just off wetin you no want.",
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
      "About page dey show community reviews, dem dey also for landing and Invite pages. Once-once you go see invite make you add your own.",
  },
};
