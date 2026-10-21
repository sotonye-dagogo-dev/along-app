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
        id: "share-route-tabs",
        question: "How is the route composer laid out?",
        answer:
          "The composer is split into four tabs — Details, Map, Score, and Drafts — so each section gets the full width instead of being squeezed into a collapsible column. Drafts shows a live count badge, and the footer keeps Save Draft and Share at opposite ends so both stay within reach. At the bottom of Details, a quick hint links straight to Map and Score — the Map link shows the live distance and estimated time, like (12.4 km · 31 min), and the Score link shows your live score, like (72/100). Find on map jumps to Map too, so you can check the tracing and improve your Route Quality Score before sharing.",
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
      {
        id: "route-time-estimates",
        question: "How are route time estimates worked out, and why do they differ from other apps?",
        answer:
          "We start with the road distance and transport mode, then calibrate the free-flow provider estimate for local Nigerian traffic. Public transport also adds realistic boarding/loading time, pick-up and drop-off time at each stop, and a single toll/roadside-levy allowance for tolls and “agbero” checkpoints. Traffic then widens the shown time range, so heavy traffic reads longer. Estimates are guidance, not a guarantee — actual times move with demand, weather and checkpoints.",
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
      {
        id: "map-tap-assign",
        question: "How do I set a stop by tapping the map?",
        answer:
          "Open the route preview and tap anywhere on the map that isn't the route line — a small card opens at the tap listing your stops. Pick the stop and the tapped point becomes that stop's location. The card closes with X or Escape, or re-anchors when you tap somewhere else. Tapping the route line itself still shows traffic for that stretch.",
      },
      {
        id: "map-find-on-map",
        question: 'What does "Find on map" do?',
        answer:
          'Every location field has "Find on map" under it. It switches to the Map tab, flies the camera to that stop (or the closest thing known — your typed text, an earlier stop, or your area) and shows a short hint that you can tap anywhere to set the point. "Use my current location" fills the field with your live position instead.',
      },
      {
        id: "map-plus-code",
        question: "Can I search with a Plus Code, like CGQC+HQ2 Lekki?",
        answer:
          'Yes — paste the code with or without the area name ("CGQC+HQ2" or "CGQC+HQ2 Lekki"). With a locality, the map resolves the code against that area and pins the nearest matching spot. The friendly place name is what shows in the field, not the raw code, unless we can\'t resolve it to a place.',
      },
      {
        id: "map-friendly-labels",
        question: "Why do location fields show place names instead of coordinates?",
        answer:
          "Whenever a pin can be reversed into a real place name — area, street, landmark — that's what the field shows, so routes stay readable and the label always matches the pin. Coordinates or plus codes only remain when we can't resolve them to a place.",
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
      {
        id: "review-prompt",
        question: "Why am I seeing a 'leave a review' prompt?",
        answer:
          "A few days after you join, Along asks for a quick rating if you haven't left one yet — the form is right in the prompt, no need to go hunting. Dismiss it with 'Not now' and it stays quiet for a week before asking again. Once you've reviewed, it never comes back (you can always update your review from your profile's Reviews tab).",
      },
    ],
  },
  {
    id: "tour",
    category: "Platform Tour",
    items: [
      {
        id: "tour-what-is-it",
        question: "What is the platform tour?",
        answer:
          "A short guided walkthrough of the app: it moves between pages, highlights the exact control it's talking about with a glowing ring, and explains what it does. Use Back/Next to move and watch the step counter. You can always leave with the X (or Escape) and most stops also offer Skip — the navigation stop hides the labelled End button so the essential following stops stay on the path, but the X still works.",
      },
      {
        id: "tour-interact",
        question: "Can I actually use the highlighted features during the tour?",
        answer:
          "Yes — steps that say so are live. Tap the highlighted control (like 'Share a route' or 'Near me'); the tour notices, confirms, and then lets you Continue or End. The navigation stop is awareness-only: it hides the labelled End button so the important sharing, request and explore stops stay on the path (press Next to continue), but the X and Escape still close the tour. The rest of the app stays fully usable while the tour is on.",
      },
      {
        id: "tour-replay-offline",
        question: "How do I replay the tour, and does it work offline?",
        answer:
          "Open your profile's quick links and choose 'Replay platform tour', use the 'Take tour' button in the guest banner, the 'Take the tour' button in the landing page hero and CTA section, the tour button on the FAQ page, or the 'Take the platform tour' link in the footer's Along column — those work for guests and signed-in users. The tour also runs offline: the guide content is stored on your device, and any stop whose page isn't available offline shows an honest note with a 'Skip this stop' option so you can keep going.",
      },
      {
        id: "tour-guests-auth",
        question: "Can guests take the tour, and does it cover signing in?",
        answer:
          "Yes. Guests can start the tour from the FAQ page or the footer without an account, and the guest walkthrough includes sign-in and registration stops (email/password, Google, or continue as guest). If you sign in or register mid-tour, your place is saved and the tour can resume after the page reloads — signed-in users skip the auth stops automatically.",
      },
      {
        id: "tour-composer",
        question: "Does the tour cover posting a route?",
        answer:
          "Yes. Tap the highlighted 'Share a route' trigger, or simply press Next and the tour opens the composer for you. It then covers all three ways to enter a location (type to search, use my current location, find on map), scrolls each highlighted field into view, switches to the Score tab to show the Route Quality Score growing, and helps you set the exact stop on the map so your post earns better trust and reach.",
      },
      {
        id: "tour-posts-requests",
        question: "Does the tour explain posts and route requests?",
        answer:
          "Yes. On your feed, the tour spotlights the first route post it finds (the feed is already ranked, so that is normally a strong example). It walks through the stops, fares and vehicle chips, the trust badge and its breakdown, and how likes, dislikes, comments and reports move a route's validity. It then highlights the Request trigger in the composer and explains how to ask the community for a route when nothing matches your journey.",
      },
      {
        id: "tour-navigation",
        question: "Does the tour cover the navigation feature?",
        answer:
          "Yes. The tour spotlights the Navigate quick link on a route post and explains that it opens the live guide with turn-by-turn stops, the map tracing, distance, time and fare. That stop is awareness-only — tap Navigate if you want to look around the guide, then press Next when you are ready. It hides the labelled End button so the following route-sharing, request and explore stops are not skipped, but you can still close the tour with the X or Escape.",
      },
      {
        id: "tour-guest-prompt",
        question: "Why don't I see a pop-up asking me to take the tour anymore?",
        answer:
          "The floating guest-tour notice was retired to avoid stacking another pop-up beside the cookie bar, install prompt and guest banner. Guests now have a permanent 'Take tour' button in the guest banner, the landing page hero and CTA section, and the footer/FAQ/profile entry points stay available. Nothing needs dismissing, so the tour is always one tap away.",
      },
      {
        id: "tour-resume",
        question: "What happens if I refresh or leave the app during the tour?",
        answer:
          "Your progress is saved on your device. After a refresh or relaunch, a small 'Tour paused' prompt offers to pick up where you left off — choose Resume tour, or Not now to keep it for later. The tour never covers the app: you can still use the theme toggle and every highlighted control while it is open.",
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
  "share-route-tabs": {
    question: "How di route composer take arrange?",
    answer:
      "Di composer get four tabs — Details, Map, Score, and Drafts — so every section get full width instead of being squeezed inside collapsible column. Drafts dey show live count badge, and di footer keep Save Draft and Share for opposite ends so both dey near your hand. For di bottom of Details, small hint go link you straight to Map and Score — di Map link dey show live distance and estimated time, like (12.4 km · 31 min), and di Score link dey show your live score, like (72/100). Find on map go jump to Map too, so you fit check di tracing and improve your Route Quality Score before you share.",
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
  "route-time-estimates": {
    question: "How una dey calculate route time, and why e dey differ from oda apps?",
    answer:
      "We dey start with road distance and transport mode, den calibrate di free-flow estimate for local Naija traffic. Public transport still add boarding/loading time, pick-up and drop-off time for each stop, and one toll/roadside-levy allowance for tolls and “agbero” checkpoints. Traffic den widen di shown time range, so heavy traffic go read longer. Na estimate, no be promise — real time dey change with demand, weather and checkpoints.",
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
  "map-tap-assign": {
    question: "How I go take set stop by tapping di map?",
    answer:
      "Open di route preview come tap anywhere for map wey no be di route line — small card go open for dat spot with your stops. Pick di stop and di place wey you tap na im go become dat stop location. Press X or Escape close am, or if you tap another place e go move re-anchor. If you tap di route line hinself, traffic for dat stretch still dey show.",
  },
  "map-find-on-map": {
    question: 'Wetin "Find on map" dey do?',
    answer:
      'Every location field get "Find on map" for under am. E dey switch go di Map tab, move camera go dat stop (or di closest thing wey we know — your typing, one earlier stop, or your area), then e show small hint say you fit tap anywhere make you set di point. "Use my current location" na to fill di field with your current position instead.',
  },
  "map-plus-code": {
    question: "I fit use Plus Code search, like CGQC+HQ2 Lekki?",
    answer:
      'Yes — paste di code with or without di area name ("CGQC+HQ2" or "CGQC+HQ2 Lekki"). With area, map go resolve di code against dat place and pin di nearest correct spot. Na di friendly place name dey show for di field, no be di raw code — except we no fit resolve am go place.',
  },
  "map-friendly-labels": {
    question: "Why location field dey show place name instead of coordinates?",
    answer:
      "Any time we fit turn pin go real place name — area, street, landmark — na im dey show for di field, so routes go easy to read and di label go always match di pin. Coordinates or plus code remain only when we no fit find place for am.",
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
  "review-prompt": {
    question: "Why I dey see 'leave a review' prompt?",
    answer:
      "Few days after you join, Along go ask you for quick rating if you never drop one before — di form dey inside di prompt, you no need go find am. Use 'Not now' to push am aside; e go rest for one week before e ask again. Once you don review, e no go come back (you fit always update am from di Reviews tab for your profile).",
  },
  "tour-what-is-it": {
    question: "Wetin be di platform tour?",
    answer:
      "Na small guided walk around di app: e dey move between pages, highlight di exact control e dey talk about with glow ring, come explain wetin e dey do. Use Back/Next to move, watch di step counter. You fit always comot with di X (or Escape) and most stops still get Skip — di navigation stop dey hide di labelled End button so di essential following stops go stay for di path, but di X still dey work.",
  },
  "tour-interact": {
    question: "I fit use di highlighted features while di tour dey go on?",
    answer:
      "Yes — steps wey talk so na live. Tap di highlighted control (like 'Share a route' or 'Near me'); di tour go notice, confirm, come allow you Continue or End. Di navigation stop na awareness-only: e dey hide di labelled End button so di important sharing, request and explore stops go remain for di path (press Next to continue), but di X and Escape still dey close di tour. Di rest of di app dey work normal while di tour dey on.",
  },
  "tour-replay-offline": {
    question: "How I go replay di tour, and e dey work offline?",
    answer:
      "Open di quick links for your profile come choose 'Replay platform tour', use di 'Take tour' button for di guest banner, di 'Take di tour' button for di landing page hero and CTA section, di tour button for FAQ page, or di 'Take the platform tour' link for di Along column for footer — dem dey work for guests and signed-in users. Di tour dey run offline too: di guide content dey store for your device, and any stop wey page no dey available offline go show you honest note with 'Skip dis stop' option so you fit continue.",
  },
  "tour-guests-auth": {
    question: "Guests fit take di tour, and e dey cover sign in?",
    answer:
      "Yes. Guests fit start di tour from FAQ page or footer without account, and di guest walkthrough include sign-in and registration stops (email/password, Google, or continue as guest). If you sign in or register mid-tour, we go save your place and di tour fit resume after di page reload — signed-in users go skip di auth stops automatically.",
  },
  "tour-composer": {
    question: "Di tour dey cover how to post route?",
    answer:
      "Yes. Tap di highlighted 'Share a route' trigger, or just press Next and di tour go open di composer for you. E go then cover all three ways to enter location (type to search, use my current location, find on map), scroll each highlighted field enter view, switch to di Score tab to show Route Quality Score dey grow, and help you set di exact stop for map so your post go earn better trust and reach.",
  },
  "tour-posts-requests": {
    question: "Di tour dey explain posts and route requests?",
    answer:
      "Yes. For your feed, di tour go spotlight di first route post e find (feed don already rank, so normally na strong example). E go walk through di stops, fares and vehicle chips, di trust badge and im breakdown, and how likes, dislikes, comments and reports dey move route validity. E go then highlight di Request trigger for composer come explain how you fit ask community for route when nothing match your journey.",
  },
  "tour-navigation": {
    question: "Di tour dey cover di navigation feature?",
    answer:
      "Yes. Di tour go spotlight di Navigate quick link for route post come explain say e dey open live guide with turn-by-turn stops, map tracing, distance, time and fare. Dat stop na awareness-only — tap Navigate if you want look around di guide, den press Next when you ready. E dey hide di labelled End button so di following route-sharing, request and explore stops no go skip, but you fit still close di tour with di X or Escape.",
  },
  "tour-guest-prompt": {
    question: "Why pop-up wey dey ask me to take tour no dey show again?",
    answer:
      "We retire di floating guest-tour notice so e no go stack another pop-up beside cookie bar, install prompt and guest banner. Guests now get permanent 'Take tour' button for di guest banner, di landing page hero and CTA section, and footer/FAQ/profile entry points still dey. Nothing need dismissing, so di tour dey always one tap away.",
  },
  "tour-resume": {
    question: "Wetin happen if I refresh or leave di app during di tour?",
    answer:
      "Your progress dey save for your device. After refresh or relaunch, small 'Tour paused' prompt go offer make you continue from where you stop — choose Resume tour, or Not now to keep am for later. Di tour no dey cover di app: you fit still use di theme toggle and every highlighted control while e open.",
  },
};
