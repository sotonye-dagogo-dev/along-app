# ReviewsPanel

**Path:** `app/components/features/reviews/ReviewsPanel.tsx` (Sprint 25)

**Purpose:** User access point for platform reviews. Star-rating form (one review per user, re-submit updates, PENDING note), guest sign-in gate, how-it-works blurb, and latest community reviews list. All copy via `tf()` with English fallbacks.

**Props:** `showList` (default true), `showForm` (default true; false on other users' profiles = read-only context), `authorId` (scopes the list to one author's platform review).

**Mounts:** own profile `reviews` tab (full), other-profile `reviews` tab (`showForm={false} authorId={profileId}`), reachable via `/profile#reviews` deep link from the About `ReviewCtaPanel`.
